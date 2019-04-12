#! -*- coding:utf-8 -*-
from .__init__ import *
# above is the magic line to be auto imported by objstate.py

from twisted.internet import reactor, defer
from twisted.web.client import Agent
from twisted.internet.protocol import Protocol
from twisted.web.iweb import UNKNOWN_LENGTH
from twisted.python import log
import twisted.internet._sslverify as v
v.platformTrust = lambda : None
import os, sys, time, json, stat, uuid, copy
import traceback
import random
import datetime
from mimetypes import MimeTypes
from whiteboard import (
    WhiteboardRootFolder, 
    WhiteboardSqliteDB,
    get_user_path, 
    get_thread_path, 
    get_slide_path,
    get_slide_thumbnail_path,
    make_uuid,
    ROOT_FOLDER
    )
PY3 = sys.version_info[0] == 3
#g00:17378e7dcfed4284b07899a938c1124c
# Register a login-type handler here to allow guest login
from objshweb import ObjectiveShellSiteRoot
import base64

if PY3:
    from io import StringIO
else:
    from cStringIO import StringIO


#
# For Auto testing
#
from objshweb import AuthWebSocketProtocol,ObjshWebUser
# don't use ssh's newline delimiter, use default objshcommand delimiter to send json data
from twisted.conch.ssh.session import SSHSessionProcessProtocol
SSHSessionProcessProtocol.use_objshcommand_delimiter = True
from objshobjects import ObjshCommand

class FakeTaskForWeb(object):
    """ a wrapper for simulation of requesting presentation_root_folder"""
    def __init__(self,user):
        self.user = user
class FakeRequest(object):
    def __init__(self,cookie=None):
        self.cookie = cookie or {}
    def getCookie(self,name):
        return self.cookie.get(name)
    def addCookie(self,name,value,expires=None,httpOnly=None,path=None,domain=None):
        self.cookie[name] = value


class WhiteboardTesting(SimpleStateValue):
    def is_ready(self):
        self.sidebyside = statetree.root.sidebyside
        
        # used by hash_report
        self.base_hashs = {}

        #statetree.root.pub.bus.add_listener(self.bus_listener)
        # server side recording
        #self._ask_report_timer = {}
        #self.bus_recording_enabled = False
        #self._bus_broadcasting_count = 0
        #self.bus_recording_playback_size = 50
        #self.bus_recording_playback_cycles = 500
        #reactor.callLater(3,self.enable_bus_recording)
    '''
    def enable_bus_recording(self):
        log.msg('==============bus recording enabled=====')
        self.bus_recording_enabled = True
        self.bus_logs = []
    
    def bus_recording_playback(self,countdown):
        self.bus_recording_enabled = False
        log.msg('playback countdown==========',countdown)
        def play(cursor): 
            task,bus_room_id,payload = self.bus_logs[cursor]
            statetree.root.pub.bus.broadcast(task,'R'+bus_room_id,payload)
            if cursor+1 < len(self.bus_logs):
                reactor.callLater(0.1,play,cursor+1)
            elif countdown > 0:
                log.msg('playback completed a cycle')                
                reactor.callLater(5,self.bus_recording_playback,countdown - 1)
            else:
                log.msg('playback completed all')
        play(0)
    
    def bus_listener(self,task,bus_room_id,payload):
        """
        task: the task which triggers the broadcasting
        room_id: without "R" prefixed, so it is p_state['bus']
        """
        #topic = payload['topic']
        delay = 3
        def ask_report(bus_room_id):
            del self._ask_report_timer[bus_room_id]
            self.base_hash = None
            data = ['report_hash']
            broadcast = lambda bus=bus_room_id,data=data:self.sidebyside.broadcast_to_bus(bus,{'topic':'test','data':data})
            reactor.callLater(0,broadcast)
            if self.bus_recording_enabled and len(self.bus_logs) > self.bus_recording_playback_size:
                self.bus_recording_playback(self.bus_recording_playback_cycles)
            elif self.bus_recording_enabled:
                log.msg('self.bus_logs length=',len(self.bus_logs))
        try:
            self._ask_report_timer[bus_room_id].reset(delay)
        except KeyError:
            self._ask_report_timer[bus_room_id] = reactor.callLater(delay,ask_report,bus_room_id)

        if self.bus_recording_enabled:
            self.bus_logs.append((task,bus_room_id,payload))
    '''

    @exportable
    def create_web_user(self, task, username):
        """
        auto generate an ObjshWebUser and remove it after disconnected
        this is for ssh-cliet to test
        """
        site = AuthWebSocketProtocol.site or AuthWebSocketProtocol.secure_site
        addr = task.protocol.transport.getPeer().address
        user_id = '%s.%s' % (addr.host, addr.port)
        web_user = ObjshWebUser(user_id,addr=addr) 
        cookie = {
            b'sbs':b'__test__'+username.encode()
        }
        fake_request = FakeRequest(cookie)
        # simulate an authentication
        ObjectiveShellSiteRoot.singleton.login_resource.type_handler['sbs'](web_user,fake_request)        
        task.user.metadata['fake_task'] = FakeTaskForWeb(web_user)
        return {
            'username':web_user.username,
            'metadata':web_user.metadata,
            'internal_metadata':web_user.internal_metadata
        }
    create_web_user.require_task = True

    @exportable
    def set_web_session(self, task,twisted_session,username):
        """
        Call this at first to hijack a web user for this ssh client.

        for using ssh to test web access, this ssh client need to hijack a web session
        For getting starts, open a browser page to this site and copy its TWISTD_SESSION.
        Then copy its username for further testing.
        """
        #
        site = AuthWebSocketProtocol.site or AuthWebSocketProtocol.secure_site
        
        web_user = None
        # search for session at first
        if twisted_session:
            twisted_session = twisted_session.encode() # to bytes
            try:
                session = site.getSession(twisted_session)
            except KeyError:
                pass
            else:
                session.touch()
                web_user = ObjshWebUser.get_by_session(session,ObjectiveShellSiteRoot.singleton.portal)
        
        # failover on twisted_session, try username if provided
        if web_user is None and username:
            web_user = ObjshWebUser.get_by_username(username)

        if web_user is None:
            raise StateError(retcode=400,message='user not found')
        
        task.user.metadata['fake_task'] = FakeTaskForWeb(web_user)
        return {
            'username':web_user.username,
            'metadata':web_user.metadata,
            'internal_metadata':web_user.internal_metadata
        }
    set_web_session.require_task = True

    @exportable
    def whoami(self,task):
        """
        Call this to check which user object is been hijacked by this ssh client
        """
        fake_task = task.user.metadata['fake_task']
        return {
            'username':task.user.username,
            'web_user':{
                'username':fake_task.user.username,
                'metadata':fake_task.user.metadata,
                'internal_metadata':fake_task.user.internal_metadata,
            }
        }
    whoami.require_task = True

    @exportable
    def get_assets_and_token(self,task):
        """
        whiteboard system does not allow accessed by flag=1, so
        we should return the acl_token to ssh client for it to access by flag 2
        """
        fake_task = task.user.metadata['fake_task']
        ret = self.sidebyside.get_assets(fake_task)
        p_id = ret['presentations'][0]
        p_state = self.sidebyside.presentation_root_folder.get_presentation_state(p_id)
        return {'p_id':p_state['id'],'acl_token':p_state['acl_token']}
    get_assets_and_token.require_task = True

    @exportable
    def get_presentation_state(self,task,p_id,flag):
        fake_task = task.user.metadata['fake_task']
        return self.sidebyside.get_presentation_state(fake_task,p_id,flag)
    get_presentation_state.require_task = True

    @exportable
    def remove_slides_of_id(self,task,p_id,flag,t_id,s_ids):
        fake_task = task.user.metadata['fake_task']
        #task,p_id,flag,t_id,s_ids
        return self.sidebyside.remove_slides_of_id(fake_task,p_id,flag,t_id,s_ids)
    remove_slides_of_id.require_task = True

    @exportable
    def remove_all_slides(self,task,p_id,flag,t_id):
        fake_task = task.user.metadata['fake_task']
        #task,p_id,flag,t_id,s_ids
        return self.sidebyside.remove_all_slides(fake_task,p_id,flag,t_id)
    remove_all_slides.require_task = True

    @exportable
    def add_blank_slide(self,args):
        """
        only flag==2 is allowed at this moment
        args:
            f: flag,
            p: p_id,
            t: t_id,
            i: insert at (-1 means end, options) 
            c: slide background color
        """
        return self.sidebyside.add_blank_slide(args) 
    @exportable
    def echo(self,*args):
        """
            called by sbs_user to make some traffic to keep connection alive if necessary
        """
        log.debug('?'*30)
        return {'retcode':0,'stdout':args}

    @resource(public=True)
    def test_data(self,request):
        """
        accessible by http://127.0.0.1:2880/@/testing/test_data
        """
        data = {
            'time': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'sbs':request.getCookie(b'sbs').decode(),
            'session': request.getCookie(b'TWISTED_SESSION').decode()
        }
        username = data['sbs'] #aks, these two are the same
        p_id = self.sidebyside.presentation_root_folder.get_assets(username)['presentations'][0]
        p_state = self.sidebyside.presentation_root_folder.get_presentation_state(p_id)
        data['acl_token'] = p_state['acl_token']

        if (request.getClientIP()=='127.0.0.1'):
            path = os.path.expanduser('~/Downloads/test_data.json')
            with open(path,'w') as fd:
                fd.write(json.dumps(data))
            return b'output to '+path.encode()+b' @'+data['time'].encode()
        else:
            content = json.dumps(data).encode()
            request.setHeader(b'Content-Disposition',b'attachment; filename=test_data.json')
            request.setHeader(b'Content-Length',str(len(content)).encode())
            return content
    
    '''
    @resource(public=True)
    def test_broadcast(self,request):
        """
        accessible by http://127.0.0.1:2880/@/testing/test_broadcast?data=<JSON encoded String>
        ex.
        http://127.0.0.1:2880/@/testing/test_broadcast?data=[%22report_hash%22,1]
        """
        username = request.getCookie(b'sbs').decode() #aks, these two are the same
        p_id = self.sidebyside.presentation_root_folder.get_assets(username)['presentations'][0]
        p_state = self.sidebyside.presentation_root_folder.get_presentation_state(p_id)
        try:
            data = request.args[b'data']
        except KeyError:
            data = ['broadcast']
        else:
            data = json.loads(data[0].decode())
            if not isinstance(data,list): data = [data]

        if data[0] == 'report_hash':
            self.base_hash = None
        broadcast = lambda bus=p_state['bus'],data=data:self.sidebyside.broadcast_to_bus(bus,{'topic':'testing','data':data})
        reactor.callLater(0,broadcast)
        return ('broadcast:topic:"test", payload="%s"' % str(data)).encode()
    '''
    @exportable
    @cancellable
    def ask_report_hash(self,task,bus,expected_count):
        """
        called by whiteboard-testing.js 
        args:
            bus is prefixed with R
            expected_count: how many number of reported to be expected?
        """
        deferred = defer.Deferred()
        key = id(task.protocol)
        now = time.time()
        report_id = int(now) - random.randint(0,10000000)        
        def report_hash(_report_id,hash):
            try:
                data = self.base_hashs[_report_id]
            except KeyError:
                log.msg('got unexisting report id',_report_id)
            else:
                data['report_count'] += 1
                #log.msg('got report id = ',_report_id,data['expected_count'] , data['report_count'])
                if data['expected_count'] == data['report_count']:
                    #log.debug('report hash deleted because of completed, id=',_report_id,'reported_count=',data['report_count'])
                    data['deferred'].callback({'diff_count':data['diff_count'],'report_count':data['report_count']})
                    del self.base_hashs[_report_id]
        
        self.base_hashs[report_id] = {'key':key,'base_hash': None, 'diff_count':0,'report_count':0,'bus':bus,'ts':now,'callback':lambda x,y=report_id:report_hash(y,x),'deferred':deferred,'expected_count':expected_count}
        # bus is prefixed with R
        broadcast = lambda x=bus:self.sidebyside.broadcast_to_bus(x,{'topic':'testing','data':['report_hash',report_id]})
        reactor.callLater(0,broadcast)
        return deferred
    ask_report_hash.require_task = True
    @ask_report_hash.disconnection_canceller
    def cancel_ask_report_hash(self,task):
        key = id(task.protocol)
        report_id = None
        # look for report_id of this connection
        for _report_id, data in self.base_hashs.items():
            if data['key'] == key:
                report_id = _report_id
                break
        if report_id:
            log.debug('report hash deleted because disconnection, id=',_report_id)
            del self.base_hashs[report_id]
    cancel_ask_report_hash.require_task = True

    @exportable
    def report_hash(self,report_id,hash):
        try:
            data = self.base_hashs[report_id]
        except KeyError:
            return {'retcode':1,'stderr':'unknow report id:%s' % report_id}
        else:
            if data['base_hash'] is None:
                data['base_hash'] = hash
                ret = {'retcode':0,'stdout':'you are base hash,len=%s' % len(hash)}        
            elif len(data['base_hash']) == len(hash):
                diff_count = 0
                for i in range(len(hash)):
                    diff_count += 1 if (hash[i] != data['base_hash'][i]) else 0
                
                if diff_count == 0:
                    ret = {'retcode':0,'stdout':'hash is the same as base hash'}
                else:
                    data['diff_count'] += 1
                    ret = {'retcode':1,'stderr':'hash is diffrent from base %s/%s' % (diff_count,len(hash))}
            else:
                data['diff_count'] += 1
                ret = {'retcode':1,'stderr':'expect hash length %s got %s' % (len(data['base_hash']) , len(hash))}
            reactor.callLater(0,data['callback'],hash)
            return ret
    @exportable
    def goodbye(self,task):
        #log.msg('client say goodbay')
        reactor.callLater(1,task.protocol.transport.loseConnection)
    goodbye.require_task = True

statetree.root.add_node('testing',WhiteboardTesting())