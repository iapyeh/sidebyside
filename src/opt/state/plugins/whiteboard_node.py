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
import hashlib
import shutil
import urllib.request, urllib.error
from mimetypes import MimeTypes
from whiteboard import (
    WhiteboardRootFolder, 
    WhiteboardSqliteDB,
    get_user_path, 
    get_thread_path, 
    get_slide_path,
    get_slide_thumbnail_path,
    make_uuid,
    timestamp,
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


# whiteboard user system
#if __main__.config.whiteboard_cluster['enable']:
#    cookie_domain =  __main__.config.whiteboard_cluster['domain']
#else:
#    cookie_domain = None

def setup_whiteboard_login_handler(s):
    def whiteboard_login(user,request):
        try:
            # user is an instance of ObjshWebUser
            # data is any value from browser
            
            # = sbs is actually the username, a user can got a new username by clearing cookie
            # = sbs_name is the title of a user

            # assign a username for unknown user by setting cookie "sbs"
            sbs_cookie = request.getCookie(b'sbs')
            if sbs_cookie is None:
                #create a new user to cookie，但是在資料庫中仍未有此一帳號
                #（這樣會有一個問題：帳號衝突不知道,有待解決）
                while True:
                    username = make_uuid()
                    try:
                        statetree.root.sidebyside.presentation_root_folder.db.user_presentation_dict[username]
                    except KeyError:
                        # this username is available
                        try:
                            n = statetree.root.sidebyside.presentation_root_folder.db.statistic_dict['username'] 
                        except:
                            traceback.print_exc()
                        else:
                            statetree.root.sidebyside.presentation_root_folder.db.statistic_dict['username'] = n + 1
                        break
                    except:
                        traceback.print_exc()
                        break
                expires = 'Tue, 19 Jan 2038 04:14:00 GMT'
                request.addCookie('sbs',username,expires=expires,httpOnly=True,path='/',domain=__main__.cookie_domain)
            else:
                username = sbs_cookie.decode() # decode from bytes to str type

            # 2019-03-11T07:30:44+00:00 應該要在這裡驗證cookie/username的合法性；
            # 但因為本系統目前不使用帳號系統，允許cookie就是username，所以此處不與資料庫比對驗證

            username_real = username
            # auto assign a title for un-titled user by setting cookie "sbsname"
            sbs_name = request.getCookie(b'sbsname')
            if not sbs_name:
                # create a new title for this user
                sbs_name = statetree.root.sidebyside.presentation_root_folder.binding_system.create_sbs_name(username_real)
                expires = 'Tue, 19 Jan 2038 04:14:00 GMT'
                request.addCookie('sbsname',sbs_name,expires=expires,path='/',domain=__main__.cookie_domain)
            else:
                sbs_name = sbs_name.decode()
                #核對binding system 的紀錄，新建之或修改之，使其與user的cookie一致
                current_sbs_name = statetree.root.sidebyside.presentation_root_folder.binding_system.get_sbs_name(username_real)
                if current_sbs_name != sbs_name:
                    if len(sbs_name) > 20: sbs_name = sbs_name[:20]
                    statetree.root.sidebyside.presentation_root_folder.binding_system.set_sbs_name(username_real,sbs_name)
            user.metadata['name'] = sbs_name

            """
            
            2019-03-11T07:33:19+00:00 binding的概念對使用者過於複雜，暫時不使用            
            
            # 查看此使用者是否有bind到別的帳號
            binded_username = statetree.root.sidebyside.presentation_root_folder.binding_system.get_binded_username(username_real)
            if isinstance(binded_username,str):
                # 如果使用者把sbsbind的cookie刪掉了(sbsbind_flag is None)，
                # 會導致他一直無法登入，所以加入 "or isinstance(binded_username,str)" 這一條件               
                username = binded_username
                # 把真的username放在 user.internal_metadata['username']
                user.internal_metadata['username'] = username_real
            elif isinstance(binded_username,list):
                # is owner (binding target)
                # 好像可以不用
                #user.metadata['binded'] = len(binded_username)
                pass
            else: # binded_username is None
                pass
            """
            user.username = username
            user.authenticated = True
            user.type = 'sbs'
            # return value should be boolean or deferred(callback with boolean)
            return True
        except:
            traceback.print_exc()
    # s.login_resource. is an instance of ObjshWebLogin
    s.login_resource.type_handler['sbs'] = whiteboard_login

if __main__.config.sidebyside_acl['public']:
    # whiteboard is always public now
    ObjectiveShellSiteRoot.call_when_singleton_created(setup_whiteboard_login_handler)


# Bridging class starts blow
class Sidebyside(SimpleStateValue):
    bus_listeners = None
    def __init__(self):
        super(Sidebyside,self).__init__()
        self.register_exception('presentation-not-found','Presentation Not Found')
        self.register_exception('thread-not-found','Thread Not Found')
        self.register_exception('invalid-access','Invalid Access',403)
        #general purpose error message (unusual error, no need to have 18n translation maybe)
        self.register_exception('unknown-error','Unknown Error(<%= message %>)',500)

        self.mimetypes = MimeTypes()

        self.presentation_root_folder = None
        if Sidebyside.bus_listeners is None:
            Sidebyside.bus_listeners = {}

        self._broadcast_throttle = {}

    def is_ready(self):
        
        self.presentation_root_folder = PresentationRootFolder()

        # add a general listener to bus to listen on all messages
        statetree.root.pub.bus.add_listener(self.bus_listener)    

    def bus_listener(self,task,bus_room_id,payload):
        """
        task: the task which triggers the broadcasting
        room_id: without "R" prefixed, so it is p_state['bus']
        """
        # task would be None when the message is broadcasting by internal nodes on server-slide
        username = task.user.username if task else None        
        topic = payload['topic']
        if topic == 'draw-sync':
            #t_id, s_id ,layer_id, [w,h,x0,y0,x1,y2,x2,y2,...] = payload['data']
            self.presentation_root_folder.on_draw_sync(username,bus_room_id,payload['data'])
        
        elif topic == 'slide-sync':
            if len(payload['data']) == 2:
                t_id, s_idx = payload['data']
                extra_resource_data = None
            else:
                # contain video info
                t_id, s_idx, extra_resource_data = payload['data']
            
            self.presentation_root_folder.on_slide_sync(username,bus_room_id,t_id,s_idx,extra_resource_data)
        
        elif topic == 'zoom-sync':
            #t_id, s_idx, scale, offsetx, offsety = payload['data']
            self.presentation_root_folder.on_zoom_sync(username,bus_room_id,payload['data'])
        elif topic == 'translate-sync':
            #t_id, s_idx, scale, offsetx, offsety = payload['data']
            self.presentation_root_folder.on_translate_sync(username,bus_room_id,payload['data'])
        elif topic == 'misc-sync':
            self.presentation_root_folder.on_misc_sync(username,bus_room_id,payload['data'])
            #self.presentation_root_folder.presentations[presentation_name].on_misc_sync(payload['data'])
        elif topic == 'widget-save':
            #on, t_id, s_idx, data = payload['data']
            self.presentation_root_folder.on_widget_save(username,bus_room_id,payload['data'])
        else:
            pass
            #statetree.log.debug('ignore topic:%s, length=%s' % (topic,len(payload['data'])if payload.get('data') else payload['length']))
            
            '''
            elif topic == 'source-sync':
                panel_name, source_name = payload['data']
                self.presentation_root_folder.folders[project_name].set_source(panel_name,source_name)
            
            elif topic == 'snapshot':
                options = {
                    'mimetype': payload['mimetype'],
                    'name':payload['name'],
                    'content':payload['_binary_']
                }            
                self.presentation_root_folder.folders[project_name].add_attachment(options)

            elif topic == 'save':
                self.presentation_root_folder.folders[project_name].serialize()
            '''
        return True
    def broadcast_to_bus(self,room_id,payload):
        """
        send data to all web users on this presentation
        Arguments:
            room_id is not prefixed by 'R'
            payload is a dict
        """
        x = lambda r=room_id,p=payload:statetree.root.pub.bus.broadcast_by_internal_node(r,p)
        reactor.callLater(0,x)
        return True
    
    '''
    @exportable
    def get_assets(self,task):
        statetree.log.debug('getting assets by %s' % task.user.username)
        return self.presentation_root_folder.get_assets(task.user.username)
    get_assets.require_task = True
    '''

    @resource_of_upload()
    def add_slides(self,request,args,content):
        """
        Caution: this is not comform to whiteboard.js
                maybe add_whiteboard() is good enough

        Upload file to presentation as slide.
        Called by SBSUser.create_presentation() in js
        Arguments:
            args:a dict,
                p: presentation id
                t: thread id, "__new__" will create a new thread
                n: filename (slide bg)
                tn: thread name when creating thread, if missing, thread name is the same as thread id of the new thread
        Returns:
            a dict,
                s: state of the created slide
                t: state of the created thread when new thread is created
        """
        #user = request.user
        #username = user.username
        #check parameter
        
        arg = args[0]
        for name in ('f','p','t','n'):#flag, presentation-id, thread-id, slide-id
            try:
                arg[name]
            except KeyError:
                return {'retcode':1, 'stderr': 'missing '+name}        
        
        flag = arg['f']
        p_id = arg['p']
        
        if flag == 1:
            p_state = self.presentation_root_folder.get_presentation_state(p_id)
        elif flag == 4:
            token = p_id
            p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        else:
            p_state = None
        
        if not p_state:
            return {'retcode':1,'stderr':'presentation error'}
        
        

        # cancel the timer of boradcasting by previous add_slides() call.
        try:
            self._broadcast_throttle[p_state['bus']].cancel()
        except KeyError:
            pass        

        try:        
            t_id = arg['t']
            stdout = {}
            if t_id == '__new__' or len(p_state['threads']) == 0:
                # "t_name" is an optional argument
                t_state = self.presentation_root_folder.add_thread_to_p_state(p_state,arg.get('tn'))
                if t_state is None:
                    return {'retcode':1,'stderr':'No more thread is available'}
            else:
                t_state = p_state['threads'].get(t_id)
                if t_state is None:
                    return {'retcode':1,'stderr':'no thread of id:%s' % t_id}
            
            # 當短時間內大量增加slide時，無法知道哪些新的s_state有送，哪些還沒送，所以乾脆一次把thread全送
            stdout['t'] = t_state
            
            #name,ext = os.path.splitext(arg['n'])
            #s_filename = '%s%s' % (abs(hash(name)),ext)
            filename = arg['n']
            self.presentation_root_folder.add_slide_to_t_state(p_state,t_state,filename,content, insert_at=arg.get('i'))
            
            add_slide_broadcast = lambda bus=p_state['bus'],payload=stdout:[self.broadcast_to_bus(bus,{'topic':'add','data':['slides',payload]}),self._broadcast_throttle.pop(bus,None)]
            self._broadcast_throttle[p_state['bus']] = reactor.callLater(1,add_slide_broadcast)

            # browser dont' handle the output (it handles broadcast's data)
            # so, simply return t_id
            return {'retcode':0,'stdout':t_state['id']} 

        except:
            return {'retcode':1, 'stderr':traceback.format_exc()}    
  
    @exportable
    def remove_slides_of_id(self,task,p_id,flag,t_id,s_ids):
        raise ValueError('do not call this, the "flag" arg has been moved to front')
        if flag == 1:
            p_state = self.presentation_root_folder.get_presentation_state(p_id)
        elif flag == 4:
            token = p_id
            p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        else:
            p_state = None
        
        if not p_state:
            self.throw('presentation-not-found')
            return False
        new_s_id = self.presentation_root_folder.remove_slides_of_id(p_state,t_id,s_ids)
        self.broadcast_to_bus(p_state['bus'],{'topic':'remove','data':['slides',t_id, s_ids, new_s_id]})
        return new_s_id
    remove_slides_of_id.require_task = True

    @exportable
    def remove_thread(self,task,p_id,t_id,flag):
        if flag == 1:
            p_state = self.presentation_root_folder.get_presentation_state(p_id)
        elif flag == 4:
            token = p_id
            p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        else:
            p_state = None
        
        if not p_state:
            self.throw('presentation-not-found')
            return False
        new_t_id = self.presentation_root_folder.remove_thread(p_state,t_id)
        self.broadcast_to_bus(p_state['bus'],{'topic':'remove','data':['thread',t_id, new_t_id]})
    remove_thread.require_task = True


    @exportable
    def create_presentation(self,task,name):
        try:
            return self.presentation_root_folder.create_presentation(task.user.username,name)
        except:
            traceback.print_exc()
            return {}
    create_presentation.require_task = True
    
    @exportable
    def remove_presentation(self,task,p_id):
        p_state = self.presentation_root_folder.get_presentation_state(p_id)
        if not (p_state and p_state['owner'] == task.user.username):
            self.throw('presentation-not-found',retcode=404)
            return
        
        default_p_id =  self.presentation_root_folder.remove_presentation(p_state)
        if default_p_id:
            self.broadcast_to_bus(p_state['bus'],{'topic':'remove','data':['presentation']})
            # 2019-03-10T08:19:06+00:00 回傳ss token讓client可以判斷是否為當下的presentation,
            # 如果是，則需跳出該presentation
            return {'ss':p_state['acl_token']['ss'], 'default_p_id': default_p_id}
        else:
            # 只剩下唯一的簡報;沒有ss token表示移除失敗
            return {'ss':''}
    remove_presentation.require_task = True

    @exportable
    def set_presentation_default(self,task,p_id):
        p_state = self.presentation_root_folder.get_presentation_state(p_id)        
        if not (p_state and p_state['owner'] == task.user.username):
            self.throw('presentation-not-found')
            return False
        self.presentation_root_folder.set_presentation_default(p_state)
        return True
    set_presentation_default.require_task = True


    @exportable
    def get_presentation_token(self,task,p_id):
        """
        2019-03-11T04:24:04+00:00
        client 讓user可以組合開啟簡報所需要的URL
        """
        p_state = self.presentation_root_folder.get_presentation_state(p_id)        
        if not (p_state and p_state['owner'] == task.user.username):
            self.throw('presentation-not-found')
            return False
        return {'ss':p_state['acl_token']['ss'],'as':p_state['acl_token']['as']}
    get_presentation_token.require_task = True


    @exportable
    def forget_me(self,task):
        number_of_presentations = self.presentation_root_folder.forget_me(task.user.username)
        return number_of_presentations
    forget_me.require_task = True

    @exportable
    def swap_slides(self,task,p_id,flag,t_id,src_indexes,dst_index):
        if flag == 1: #owner
            p_state = self.presentation_root_folder.get_presentation_state(p_id)
        elif flag == 4: #shared dashboard user
            token = p_id
            p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        else:
            p_state = None
        
        if not p_state:
            self.throw('presentation-not-found')
        
        try:
            t_state = p_state['threads'][t_id]
        except KeyError:
            self.throw('thread-not-found')
        self.presentation_root_folder.swap_slides(p_state,t_state,src_indexes,dst_index)
        self.broadcast_to_bus(p_state['bus'],{'topic':'swap','data':['slides',t_id,src_indexes,dst_index]})
        return True
    swap_slides.require_task = True

    @exportable
    def audience_screen(self,task,p_id,flag,start):
        """
        Turn-on, turn-off the audience screen.
        """
        if flag == 1:
            p_state = self.presentation_root_folder.get_presentation_state(p_id)
            if p_state['owner'] != task.user.username:
                self.throw('presentation-not-found')
                return
        else:
            # flag == 4 (dashboard sharing token)
            token = p_id
            p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        
        if p_state is None:
            self.throw('presentation-not-found')      
            return
        
        if start:
            token = self.presentation_root_folder.start_audience_screen(p_state)
            self.broadcast_to_bus(p_state['bus'],{'topic':'refresh','data':['acl_token']})
            return token
        else:
            self.presentation_root_folder.shutdown_audience_screen(p_state)
            self.broadcast_to_bus(p_state['bus'],{'topic':'shutdown','data':['audience-screen']})
            return True
    audience_screen.require_task = True

    @exportable
    def speaker_screen(self,task,p_id,flag,start):
        """
        Turn-on, turn-off the speaker screen.
        """
        if flag == 1:
            p_state = self.presentation_root_folder.get_presentation_state(p_id)
            if p_state['owner'] != task.user.username:
                self.throw('presentation-not-found')
                return
        else:
            # flag == 4 (dashboard sharing token)
            token = p_id
            p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        
        if p_state is None:
            self.throw('presentation-not-found')      
            return

        if start:
            token = self.presentation_root_folder.start_speaker_screen(p_state)
            self.broadcast_to_bus(p_state['bus'],{'topic':'refresh','data':['acl_token']})
            return token
        else:
            self.presentation_root_folder.shutdown_speaker_screen(p_state)
            self.broadcast_to_bus(p_state['bus'],{'topic':'shutdown','data':['speaker-screen']})
            return True
    speaker_screen.require_task = True

    @exportable
    def dashboard_sharing(self,task,p_id,start):
        """
        Turn-on, turn-off the dashboard sharing
        """
        p_state = self.presentation_root_folder.get_presentation_state(p_id)
        if p_state['owner'] != task.user.username:
            self.throw('presentation-not-found')
            return
        
        if start:
            token = self.presentation_root_folder.start_dashboard_sharing(p_state)
            # request client to refresh acl_token
            self.broadcast_to_bus(p_state['bus'],{'topic':'refresh','data':['acl_token']})
            return token
        else:
            self.presentation_root_folder.shutdown_dashboard_sharing(p_state)
            self.broadcast_to_bus(p_state['bus'],{'topic':'shutdown','data':['dashboard-sharing']})
            return True
    dashboard_sharing.require_task = True

    #
    # Serivces for requests via http/https (not websocket)
    #
    @resource()
    def thumbnail(self,request):
        """
        Get the raw content of thumbnail of presentation or slide
        """

        p_id = request.args.get(b'p',[None])[0]
        flag = int(request.args.get(b'f',[0])[0])
        t_id = request.args.get(b't',[None])[0]
        s_id = request.args.get(b's',[None])[0]
        
        if not (p_id and flag):
            request.setResponseCode(404)
            return b'parameter error'
        
        if PY3:
            p_id = p_id.decode()
            if t_id: t_id = t_id.decode()
            if s_id: s_id = s_id.decode()

        if flag == 1:
            p_state = self.presentation_root_folder.get_presentation_state(p_id)
        elif flag == 4:
            token = p_id
            p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        else:
            p_state = None
        
        if not p_state:
            request.setResponseCode(404)
            return b'no presentation'
      
        if t_id is None:
            t_id = p_state['presentation_layout']['panels']['main']
        
            if t_id is None:
                # find the 1st thread has slides
                if len(p_state['threads']):
                    t_ids = sorted(p_state['threads'].keys())
                    for t_id in t_ids:
                        if len(p_state['threads'][t_id]['slides']) > 0: break
            
            if t_id:
                t_state = p_state['threads'][t_id]
                if len(t_state['slides']):
                    s_id = t_state['slides'][0]['id']
        # request for slides' thumbnail
        if not (t_id and s_id):
            request.setResponseCode(302)
            # redirect to relative path ("app")
            # absolute path does not work when behide nginx
            # this is called by @/sidebyside/thumbnail?...
            # so it have to be ../../app for access thumbnail_empty.jpg
            request.redirect('../../app/thumbnail_empty.jpg')
            return b'no slide'

        thumbnail_path = get_slide_thumbnail_path(p_state['owner'],p_state['id'],t_id,s_id)        
        request.setResponseCode(200)
        request.setHeader('content-type','image/jpeg')
        request.setHeader('content-length',os.stat(thumbnail_path)[stat.ST_SIZE])
        with open(thumbnail_path,'rb') as fd:
            request.write(fd.read())
        reactor.callLater(0,request.finish)

    
    @exportable
    def content_for_thumbnail(self,url):
        agent = Agent(reactor)
        deferred = defer.Deferred()
        if PY3: url = url.encode()
        d = agent.request(
            b'GET',
            url,
            #Headers({'User-Agent': ['Twisted Web Client Example']}),
            None)

        class SaveContents(Protocol):
            def __init__(self, finished, filesize):
                self.finished = finished
                self.remaining = None if filesize == UNKNOWN_LENGTH else filesize
                self.outfile = StringIO()
                self.called = False
                self.content = ''
            def dataReceived(self, bytes):
                if self.remaining:
                    display = bytes[:self.remaining]
                    if PY3:
                        self.outfile.write(display.decode())
                    else:
                        self.outfile.write(display)
                    self.remaining -= len(display)

                    if self.remaining == 0 and not self.called:
                        self.called = True
                        self.content = self.outfile.getvalue()
                        self.outfile.close()
                        self.finished.callback(self.content)
                else:
                    if PY3:
                        self.outfile.write(bytes.decode())
                    else:
                        self.outfile.write(bytes)

            def connectionLost(self, reason):
                #print 'Finished receiving body:', reason.getErrorMessage()
                if not self.called:
                    self.called = True
                    self.content = self.outfile.getvalue()
                    self.outfile.close()
                    self.finished.callback(self.content)

        def done(content):
            deferred.callback(content)

        def cbRequest(response):
            finished = defer.Deferred()
            finished.addCallback(done)
            response.deliverBody(SaveContents(finished, response.length))
            return finished

        d.addCallback(cbRequest)
        return deferred
        #https://www.googleapis.com/pagespeedonline/v1/runPagespeed?screenshot=true&strategy=mobile&url=http://www.google.com
        
    @resource(public=True)
    def raw(self,request):
        """
        request raw data (ex.image) of local source file
        """

        for name in (b'p',b'f',b't',b's'):#flag, presentation-id, thread-id, slide-id
            try:
                request.args[name]
            except KeyError:
                request.setResponseCode(404)
                return b'Not Found'

        p_id = request.args[b'p'][0]
        flag = int(request.args[b'f'][0])
        t_id = request.args[b't'][0]
        s_id = request.args[b's'][0]
        
        if PY3:
            p_id = p_id.decode()
            t_id = t_id.decode()
            s_id = s_id.decode()
        
        if flag == 1:
            p_state = self.presentation_root_folder.get_presentation_state(p_id)
        else:
            token = p_id
            p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        
        if not p_state:
            request.setResponseCode(404)
            return b'No Presentation'

        slide_path = get_slide_path(p_state['owner'],p_state['id'],t_id,s_id)
        try:
            request.setResponseCode(200)
            mimetype, _ = self.mimetypes.guess_type(slide_path)
            request.setHeader(b'content-type',mimetype.encode() if PY3 else mimetype)
            request.setHeader(b'content-length',os.stat(slide_path)[stat.ST_SIZE])
            with open(slide_path,'rb') as fd:
                request.write(fd.read())
        except IOError:
            request.setResponseCode(404)
            request.redirect(b'/404.html')
            return b''
        reactor.callLater(0,request.finish)

    @resource(public=True)
    def config(self,request):
        """
            this is called by <script src="../@/sidebyside/config"></script>
            Currently, it gives sbs_user.js settings about serever.
            its value comes from ~/.sidebyside/sidebyside_conf.py.
            its is loaded by tree_of_sidebyside/etc/config.py to be "__main__.config.sidebyside_config"
            the value is converted into json when sending to browser.
        """
        
        user = ObjectiveShellSiteRoot.singleton.login_resource.get_user(request)
        sidebyside_config = __main__.config.sidebyside_config
        js = 'var sidebyside_config = JSON.parse(\'%s\');' % json.dumps(sidebyside_config)
        if (user.authenticated):
            js +=';sidebyside_config.username="%s"' % user.username
            if user.username == __main__.config.sidebyside_acl['admin']:
                js +=';sidebyside_config.admin=1'

        return js.encode()
    
    @exportable
    def heartbeat(self):
        """
            called by sbs_user to make some traffic to keep connection alive if necessary
        """
        return 1

class Whiteboard(Sidebyside):
    def is_ready(self):
        if __main__.config.whiteboard_cluster['enable']:
            from whiteboard import WhiteboardElasticSearchDB
            objectstore_url = __main__.config.whiteboard_cluster['objectstore_url']
            self.presentation_root_folder = WhiteboardRootFolder(WhiteboardElasticSearchDB(objectstore_url))
        else:
            self.presentation_root_folder = WhiteboardRootFolder(WhiteboardSqliteDB(ROOT_FOLDER))
        
        self.host = self.presentation_root_folder.host
        self.access_path = self.presentation_root_folder.access_path
        self.is_cluster_member = self.presentation_root_folder.is_cluster_member
        # add a general listener to bus to listen on all messages
        statetree.root.pub.bus.add_listener(self.bus_listener)  
        #return super(Whiteboard,self).is_ready()

        # a cache to store invitation of binding
        self.invite_binding_queue = {}
    
    
    '''
    @exportable
    def get_assets(self,task):
        """
        2019-03-08T09:45:02+00:00
        注意：希望不要再呼叫這個函數了, call get_user_presentations instead
        """
        raise NotImplementedError('dont call')
        statetree.log.debug('getting assets by ',[task.user.username])
        ret = self.presentation_root_folder.get_assets(task.user.username)
        # 以目前的實作, create presentation已經在@/sidebyside/config當中呼叫，
        # 應該必然已經有一個了才對(2018/12/31)
        assert len(ret['presentations']) >= 1
        return ret
    get_assets.require_task = True
    '''

    @exportable
    def get_all_presentations(self,task):
        """
        取得user所有的whiteboard
        """
        a_dict = self.presentation_root_folder.get_presentations(task.user.username)
        return a_dict

    get_all_presentations.require_task = True

    def get_default_presentation(self,username, name_for_creation=None):
        """
        取得user的預設whiteboard
        這是login使用，所以不使用以下的快速取得ss token的方式
        m = hashlib.md5()
        m.update(username.encode())
        self.db.user_presentation_dict[m.hexdigest()] = {2:p_state['acl_token']['ss']}

        """
        a_dict = self.presentation_root_folder.get_presentations(username)
        p_state = None
        if a_dict and len(a_dict) > 0:
            for p_id, p_data in a_dict.items():
                if p_data['default']:
                    p_state = self.presentation_root_folder.get_presentation_state(p_id)
                    break
        if (name_for_creation is None) or (p_state is not None):
            return p_state
        
        # 自動產生一個新的簡報
        # auto create a default presentation of a single thread
        sbs_name = name_for_creation #user.metadata['name']
        # request to sync to db immediately, so the 3rd parameter is True
        ret = self.presentation_root_folder.create_presentation(username,sbs_name,True)        
        return ret['p_state']

    @resource(public=True)
    def config(self,request):
        """
        Support both single server and cluster scenario.

        1. Every entrance web page (ex whiteboard.html) should have <scrpt src=" ../@/sidebyside/config"/> in header
        2. Cookies of sbs and sbsname have to be set to "domain", so the cluster servers would share same cookie values
        a var named "sidebyside_config" will be returned. In sidebyside_config,
        acl_token of his/her whiteboard (a single presentation) is included.
        """
        # 在cluster情境時，要根據所在的presentation指定一台server給此使用者
        # 讓讀取同一個presentation的user由同一個server所服務 (此同一presentation由"access_token+flag"所代表)
        try:
            # 先瞭解意圖存取的presentation(board)
            path_2, path_1 = (x.decode() for x in request.path.split(b'/')[-2:])
            flag = None;
            token = None
            stderr = None
            if path_1 == 'config':
                # request for user's own presentation
                pass
            elif path_2 == 'config':
                # request for some board
                flag = path_1[0]
                token = path_1[1:]
                if flag == '2' or flag == '3':
                    pass
                elif flag=='0':
                    if len(token)==6 and token.isdigit():
                        # 快速傳送碼（到某一個簡報）
                        # token is quickshort code, convert it to token and flag
                        token, flag_int = self.presentation_root_folder.quickshortcut.resolve_code(token)
                        flag = str(flag_int)
                    else:
                        # 使用userhash進入該使用者預設的簡報
                        # 為什麼要有這個數值呢？因為當剛喬治要取得瑪麗的簡報時,
                        # 喬治並不知道那個簡報的TOKEN也不知道瑪麗的username的token他只能知道瑪麗的userename的hash value
                        try:
                            _dict = self.presentation_root_folder.db.user_presentation_dict[token]
                            flag_int = 2
                            token = _dict[flag_int]
                        except KeyError:
                            # 使用者可能因進入別人的版而在who_are_join當中被觸發而呼叫，實際上此時該使用者並未進入自己的版
                            # 所以此userhash取不到實際的token
                            token = None
                            stderr = 'Board has not created yet'
                        else:
                            flag = str(flag_int)
                    
                    if token is None:
                        # 可能shortcut code 已經過期, 或是自己亂填, 或者該presentation(board)還沒有建立
                        js = 'var global_config=JSON.parse(\'%s\');\n' % json.dumps({'retcode':1,'stderr':stderr or 'Invalid code'})
                        return js.encode()
                else:
                    token = None
            
                if not token: # None or ''
                    # 不正常的情況，直接拒絕，無須說明
                    request.setResponseCode(403)
                    return b'Forbidden'
            del path_1, path_2            
            #此時應取得flag與token
            
            user = None
            # host is identified by access_path, 
            # so value of delegate_host is "access_path of that host"
            delegate_host = None
            sbs = request.getCookie(b'sbs')
            p_state = None

            if sbs is not None: sbs = sbs.decode()
            
            if token is None and sbs is None:
                # case 1
                # 全新的使用者（第一次登入的設備；或者已經將cookie洗掉）,要進入自己的board
                # 讓此user先login,login 完後會重新request此CGI，進入case 3 的狀況                
                # 要求此使用者先登入目前這台（因為 user is None)
                log.debug('case >>>>> 1')
                delegate_host = None
            elif sbs is None: #token is not None
                # case 2
                # 全新的使用者（第一次登入的設備；或者已經將cookie洗掉）, 想存取某一既有的presentation
                # 此user會先在本機或該token所在的host進入 case 3，
                # 然後再被要求login,完成login後會重新request此CGI，進入case 3 的狀況。
                # 因此在client那邊的whiteboard.js可能會有好此次request的情況產生
                if self.is_cluster_member:
                    delegate_host = self.presentation_root_folder.get_delegate_host(token)
                else:
                    delegate_host = None #目前這台
                log.debug('case >>>>> 2, delegate_host=',delegate_host)
                '''
                elif token is None: #sbs is not None
                    # case 3
                    # 要存取自己的presentation或者自己bind的presentation 
                    # 已經註冊（但也有可能是自己產生cookie的攻擊者)，但登入與否未知，
                    # an existing user object on this single server will be created
                    if self.is_cluster_member:
                        username = sbs
                        binded_username = self.presentation_root_folder.binding_system.get_binded_username(username)
                        # 如果已經 bind 到別人，則改變username
                        if isinstance(binded_username,str):
                            username = binded_username

                        p_state = self.get_default_presentation(username)
                        if p_state:
                            # 此sbs已經有自己的presentation，問cluster分配一台server讓他使用
                            token = p_state['acl_token']['ss']
                            delegate_host = self.presentation_root_folder.get_delegate_host(token)
                        else:
                            # 還沒有自己的presentation，問cluster任意分配一台server讓他使用
                            delegate_host = self.presentation_root_folder.get_delegate_host()
                        
                        if delegate_host == self.access_path:
                            user = ObjectiveShellSiteRoot.singleton.login_resource.get_user(request)
                            if user.authenticated and token is None:
                                p_state = self.get_default_presentation(username,user.metadata['name'])
                                token = p_state['acl_token']['ss']
                                # 因為在呼叫 self.presentation_root_folder.get_delegate_host() 時，還沒有資料
                                # 此處需把新產生的board,跟delegate host 之間的關係寫回 delegate host 查詢表
                                self.presentation_root_folder.update_delegate_host(delegate_host,token)
                    else:
                        user = ObjectiveShellSiteRoot.singleton.login_resource.get_user(request)
                        if user.authenticated:
                            name = user.metadata['name']
                            # 在single server下，保證有值，因為沒有的話get_defaul_presentation會自動產生一個presentation
                            # 此處直接取得新建的p_state，因為 self.presentation_root_folder.get_presentation_state_token(token,flag)
                            # 因為sqlitdict時機的緣故而還沒commit的話，會取不到值，造成第一次新創的presentation 無法進入
                            p_state = self.get_default_presentation(user.username, name)
                            token = p_state['acl_token']['ss']
                        else:
                            pass
                        delegate_host = None #目前這台（正確的host)
                '''
            
            elif token is None:
                # case 3
                # 要存取自己的presentation或者自己bind的presentation 
                # 已經註冊（但也有可能是自己產生cookie的攻擊者)，但登入與否未知，
                # an existing user object on this single server will be created
                user = ObjectiveShellSiteRoot.singleton.login_resource.get_user(request)
                if user.authenticated and user.type == 'sbs':
                    name = user.metadata['name'] #aka sbsname of Cookie
                    log.debug('case >>>>> 3-1 user authenticated, username=',user.username)
                    if self.is_cluster_member:
                        # 此username可能已經完成binder轉換之後的username
                        p_state = self.get_default_presentation(user.username)
                        if p_state:
                            # 此sbs已經有自己的presentation，問cluster該到哪台主機去
                            token = p_state['acl_token']['ss']
                            delegate_host = self.presentation_root_folder.get_delegate_host(token)
                            log.debug('case >>>>> 3-1-1 p_state existed delegate_host=', delegate_host, 'token=',token)
                        else:
                            # 還沒有自己的presentation，先做一個presentation給他
                            p_state = self.get_default_presentation(user.username, name)
                            token = p_state['acl_token']['ss']
                            # 再問cluster該分配到哪台主機去
                            delegate_host = self.presentation_root_folder.get_delegate_host(token)
                            log.debug('case >>>>> 3-1-2 p_state new created, delegate_host=', delegate_host, 'token=',token)
                    else:
                        # 在single server下，保證有值，因為沒有的話get_default_presentation會自動產生一個presentation
                        # 此處直接取得新建的p_state，因為 self.presentation_root_folder.get_presentation_state_token(token,flag)
                        # 受到sqlitdict cache功能的影響，不會馬上commit，因此查詢會取不到值，造成第一次新創的presentation 無法進入
                        # (2018/12/31 新版的get_default_presentation已經會在新創簡報的情況時，要求立刻commit)
                        p_state = self.get_default_presentation(user.username, name)
                        token = p_state['acl_token']['ss']
                else:
                    log.debug('case >>>>> 3-2 user not authenticated or not user.type=="sbs"')
                    # 登入本機以後再來
                    delegate_host = None
                '''
                if self.is_cluster_member:
                    username = sbs
                    binded_username = self.presentation_root_folder.binding_system.get_binded_username(username)
                    # 如果已經 bind 到別人，則改變username
                    if isinstance(binded_username,str):
                        username = binded_username

                    p_state = self.get_default_presentation(username)
                    if p_state:
                        # 此sbs已經有自己的presentation，問cluster分配一台server讓他使用
                        token = p_state['acl_token']['ss']
                        delegate_host = self.presentation_root_folder.get_delegate_host(token)
                    else:
                        # 還沒有自己的presentation，問cluster任意分配一台server讓他使用
                        delegate_host = self.presentation_root_folder.get_delegate_host()
                    
                    if delegate_host == self.access_path:
                        user = ObjectiveShellSiteRoot.singleton.login_resource.get_user(request)
                        if user.authenticated and token is None:
                            p_state = self.get_default_presentation(username,user.metadata['name'])
                            token = p_state['acl_token']['ss']
                            # 因為在呼叫 self.presentation_root_folder.get_delegate_host() 時，還沒有資料
                            # 此處需把新產生的board,跟delegate host 之間的關係寫回 delegate host 查詢表
                            self.presentation_root_folder.update_delegate_host(delegate_host,token)
                '''
            else:
                # case 4
                # 既有的使用者存取某presentation;使用者可能在其他機登入的，而在本機還沒登入
                # 但是會到本機來request 此config，可能是別的主機重導過來的
                user = ObjectiveShellSiteRoot.singleton.login_resource.get_user(request)
                if user.authenticated:
                    if self.is_cluster_member:
                        delegate_host = self.presentation_root_folder.get_delegate_host(token)
                    else:
                        delegate_host = None #目前這台
                    log.debug('case >>>>> 4 delegate_host=', delegate_host)
                    # 依據目前的設計，所有的flag為2
                    flag = 2
                    p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
                else:
                    # 重新login到本機
                    delegate_host = None
            # 此request不該連到此host，重導之
            if delegate_host is not None and (delegate_host != self.access_path):
                log.debug('config---> redirect to ',delegate_host,'from',self.access_path)
                js = 'var global_config=JSON.parse(\'%s\');\n' % json.dumps({'host':self.access_path, 'delegate_host':delegate_host,'flag':flag,'token':token})
                return js.encode()
            # 需要先登入到此server
            elif not (user and user.authenticated):
                log.debug('config---> do login in advance')
                # 此request需login後再來取config
                js = 'var global_config=JSON.parse(\'%s\');\n' % json.dumps({'require_login':1,'host':self.access_path,'flag':flag,'token':token})
                return js.encode()
            elif not user.type=='sbs':
                js = 'var global_config=JSON.parse(\'%s\');\n' % json.dumps({'redirect':1,'url':self.access_path+'logout'})
                return js.encode()
            assert token is not None
            # 輸出
            global_config = __main__.config.global_config_secure if request.isSecure() else __main__.config.global_config
            js = 'var global_config = JSON.parse(\'%s\');\n' % json.dumps(global_config)
            
            #if p_state is None:
            #    # 依據目前的設計，所有的flag為2
            #    flag = 2
            #    p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
            
            if p_state is None:
                #self.throw('presentation-not-found')
                js += ';\n/*presenstation not found*/'
            else:
                js +=';\nglobal_config.ss_token=JSON.parse(\'%s\')' % json.dumps(p_state['acl_token']['ss'])
                if p_state['owner'] == user.username:
                    # owner
                    js += ';\nglobal_config.require_passcode = 0'
                elif p_state['acl_token']['ps']:
                    # partner and a locked board
                    js += ';\nglobal_config.require_passcode = 1'
                else:
                    js += ';\nglobal_config.require_passcode = 0'
            
            # (temporary disabled for all vscode-relasted)
            # VScode's webview does not send cookie
            #js += ';\nglobal_config.user=JSON.parse(\''+json.dumps({'username':user.username,'name':user.metadata['name']})+'\')'
            
            #(temporary disabled, because not useful)
            #if user.username == __main__.config.sidebyside_acl['admin']:
            #    js +=';\nglobal_config.admin=1'
            
            js += ';\nconsole.log(\'global_config=\',global_config)'
            return js.encode()
        except:
            traceback.print_exc()
            return traceback.format_exc().encode()

    @exportable
    def add_blank_slide(self,args):
        """
        only flag==2 is allowed at this moment
        args:
            f: flag,
            p: p_id,
            t: t_id,
            i: insert at (-1 means end, options) 
            c: slide background color (without #, ex, FFFFFF, FF00FF)
            y: syncing (boolean)
        """

        for name in ('f','p','t'):#flag, presentation-id, thread-id,
            try:
                args[name]
            except KeyError:
                return {'retcode':1, 'stderr': 'missing '+name}        
        
        flag = args['f']
        p_id = args['p']
        
        if flag==2:
            token = p_id
            p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        else:
            p_state = None
        if not p_state:
            return {'retcode':1,'stderr':'presentation error'}
            

        # cancel the timer of boradcasting by previous add_slides() call.
        try:
            self._broadcast_throttle[p_state['bus']].cancel()
        except KeyError:
            pass        

        try:        
            t_id = args['t']
            stdout = {}
            t_state = p_state['threads'].get(t_id)
            if t_state is None:
                return {'retcode':1,'stderr':'no thread of id:%s' % t_id}
            insert_at = args.get('i',-1)
            color = args.get('c','FFFFFF')
            print('color-',color)
            #p_state,t_state,color='',insert_at=-1,as_focus=True,update_db=True):
            slide_state_obj = self.presentation_root_folder.add_blank_slide_to_t_state(p_state,t_state,color,insert_at)

            stdout['t'] = t_id
            stdout['s'] = slide_state_obj.state
            stdout['i'] = insert_at #insert index, multiple slides might call add continuously
            
            try:
                syncing = args['y']
            except KeyError:
                # 此slide為not syncing的使用者所增加，除了該增加者之外，其他人不要切換過去
                syncing = False
            stdout['fo'] = syncing # request browser to navigate to this new slide

            add_slide_broadcast = lambda bus=p_state['bus'],payload=stdout: self.broadcast_to_bus(bus,{'topic':'add','data':['slide',payload]})
            reactor.callLater(0.25,add_slide_broadcast)

            # browser dont' handle the output (it handles broadcast's data)
            # so, simply return t_id
            return {'retcode':0,'stdout':t_state['id']} 
        except:
            log.debug(traceback.format_exc())
            return {'retcode':1, 'stderr':traceback.format_exc()} 

    @exportable
    def remove_slides_of_id(self,task,p_id,flag,t_id,s_ids):
        raise StateError(retcode=500,message='remove_slides_of_id is deprecated, use remove_slides_of_idx instead')
    
 
    @exportable
    def remove_slides_of_idx(self,task,p_id,flag,t_id,s_idxes):
        """
        only flag==2 is allowed at whiteboard
        when the thread has one slide only, that slide will be reset instead of removed
        刪除多個slide，但是留下一個，最後一個只做reset 清除
        Args:
            s_ids: at whiteboard, only one slide been removed [<slide_id>],
                   except for s_ids is None, at this case, all slides will be remove (1st slide will be reset)
        """
        #whiteboard client send 1 slide to delete only
        assert (s_idxes is None) or len(s_idxes) == 1 ,'can only remove 1 slide at a call'
        assert flag == 2, 'expect flag 2, got %s' % flag

        token = p_id
        p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        
        if not p_state:
            self.throw('presentation-not-found')
            return False
    
        username = task.user.username
        t_state = p_state['threads'][t_id]
        if len(t_state['slides']) < 2:
            # reset the first slide
            new_s_idx = 0
            # changed_states = [(s_idx, s_state)*]
            changed_s_states = self.presentation_root_folder.reset_slides_of_idx(p_state,t_id,[0])
            self.broadcast_to_bus(p_state['bus'],{'topic':'refresh','data':['slides',t_id, changed_s_states ]})
        else:
            if s_idxes is None:
                # remove all slide and reset 1st one
                s_idxes = list(range(1,len(t_state['slides'])))
                new_s_idx = 0
                changed_s_states = self.presentation_root_folder.reset_slides_of_idx(p_state,t_id,[0])
                self.presentation_root_folder.remove_slides_of_idx(p_state,t_id,s_idxes)
                self.broadcast_to_bus(p_state['bus'],{'topic':'remove','data':['slides-idx',t_id,'__ALL__',changed_s_states]})
            else:
                new_s_idx = self.presentation_root_folder.remove_slides_of_idx(p_state,t_id,s_idxes)
                self.broadcast_to_bus(p_state['bus'],{'topic':'remove','data':['slides-idx',t_id, s_idxes, new_s_idx]})
        return new_s_idx
    remove_slides_of_idx.require_task = True
    
    @exportable
    def reset_slides_of_idx(self,task,p_id,flag,t_id,s_idxes):
        """
        only flag==2 is allowed at whiteboard
        清除 slide
        Args:
            s_idxes:(list) [slides的idx] or None, if None then reset all slides
        """
        #whiteboard client send 1 slide to delete only
        assert (s_idxes is None) or len(s_idxes) == 1 ,'can only remove 1 slide at a call'
        assert flag == 2, 'expect flag 2, got %s' % flag

        token = p_id
        p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        
        if not p_state:
            self.throw('presentation-not-found')
            return False
    
        #username = task.user.username
        t_state = p_state['threads'][t_id]
        if s_idxes is None:
            # remove all slide and reset 1st one
            s_idxes = list(range(0,len(t_state['slides'])))
        changed_s_states = self.presentation_root_folder.reset_slides_of_idx(p_state,t_id,s_idxes)
        self.broadcast_to_bus(p_state['bus'],{'topic':'refresh','data':['slides',t_id,changed_s_states]})
        # focus slide 不變
        return True
    reset_slides_of_idx.require_task = True

    @exportable
    def remove_all_slides(self,task,p_id,flag,t_id):
        return self.remove_slides_of_idx(task,p_id,flag,t_id,None)
    remove_all_slides.require_task = True
    
    def bus_listener(self,task,bus_room_id,payload):
        """
        task: the task which triggers the broadcasting
        bus_room_id: without "R" prefixed, so it is p_state['bus']
        """        
        # task would be None when the message is broadcasting by internal nodes on server-slide
        username = task.user.username if task else None
        topic = payload['topic']
        if topic == 'refresh':
            self.presentation_root_folder.on_refresh(username,bus_room_id,payload['data'])
        elif topic == '_ANNOUNCE_':
            if payload['data']['type'] == 'JOIN':
                self.presentation_root_folder.increase_active_count()
            elif payload['data']['type'] == 'LEAVE':
                self.presentation_root_folder.decrease_active_count()
        else:
            super(Whiteboard,self).bus_listener(task,bus_room_id,payload)

    @exportable
    def get_presentation_state(self,task,p_id,flag,topic=None,passcode=None):
        """
        (modified by whiteboard to send "is_owner" back to browser)

        dashboard.js, screen.js, whiteboard.js  call this to initialize (via presentation.js)
        Arguments:
            p_id: presentation id or token depends on flag
            flag: 1, given p_id is presentation id (owner)
            flag: 2, given p_id is token for speaker screen
            flag: 3, given p_id is token for audience screen
            flag: 4, given p_id is token for dashboard sharing
            topic:(optional) partial state is required only (called by dashboard)

        """
        if not (flag == 2 or flag == 3):
            log.debug('expected flag is 2 or 3, but got %s' % [flag]) #whiteboard allow flag=2 or 3 only
            self.throw('invalid-access')
            return 
        
        token = p_id
        p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        
        if p_state is None:
            self.throw('presentation-not-found')
            return
        
        
        is_owner =  p_state['owner'] == task.user.username

        '''           
        try:
            # reverify binder again
            if task.user.metadata['binder']:
                username_binder = task.user.internal_metadata['username']
                if not self.presentation_root_folder.binding_system.isbinder(username_binder,task.user.username):
                    cookie = 'sbsbind=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/'+ ('; domain='+__main__.cookie_domain if __main__.cookie_domain else '')
                    raise StateError(message='invalid binder',retcode=400, data={'cookie':cookie})
        except KeyError:
            pass
        '''

        # check passcode for non-owner if passcode has set
        if (not is_owner) and (p_state['acl_token']['ps']) and (p_state['acl_token']['ps'] != passcode):
            self.throw('invalid-access')
            return
        # owner must be removed and never passed to browser
        # remove acl_token except for owner and for dashboard
        # p_id is removed to inprome security (only owner know the pid)
        if topic is None:
            p_state_4_guest = copy.deepcopy(p_state)
            p_state_4_guest['is_owner'] = is_owner

            for key in ['owner','id']:
                del p_state_4_guest[key]

            # remove shared-dashboard token from acl_token in speark screen
            if flag == 2:
                del p_state_4_guest['acl_token']['ds']
                # remove passcode for not owner
                if not is_owner:
                    del p_state_4_guest['acl_token']['ps']
            elif flag == 3:
                # audience screen token
                del p_state_4_guest['acl_token']
        
            # for generate qrcode
            p_state_4_guest['hostname'] = self.presentation_root_folder.hostname

            binding = {'binder':False, 'binded':False}
            try:
                username = task.user.internal_metadata['username']
            except KeyError:
                username = task.user.username
            binded_username = statetree.root.sidebyside.presentation_root_folder.binding_system.get_binded_username(username)
            if isinstance(binded_username,str):
                binding['binder'] = True
            elif isinstance(binded_username,list):
                binding['binded'] = len(binded_username)
            else:
                pass
            p_state_4_guest['binding'] = binding
            return p_state_4_guest
        #
        #elif topic == 'acl_token' and (flag == 1 or flag == 4):
        #    return  p_state['acl_token']        
    get_presentation_state.require_task = True

    @exportable
    def set_passcode(self,task,p_id,flag,passcode):
        """
        Arguments:
            p_id: presentation id or token depends on flag
            flag: 1, given p_id is presentation id (owner)
            flag: 2, given p_id is token for speaker screen
            flag: 3, given p_id is token for audience screen
            flag: 4, given p_id is token for dashboard sharing
        """
        #whiteboard owner use flag 2 only
        assert flag == 2
        token = p_id
        p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        
        if p_state is None:
            self.throw('presentation-not-found')
            return
        
        # only owner or binder can change passcode
        assert p_state['owner'] == task.user.username
        # limit to 20 bytes for cheap security
        passcode20 = passcode[:20]
        self.presentation_root_folder.set_presentation_passcode(p_state,passcode20)
        # request client to reload if passcode has set (not public accessible)
        if len(passcode20):
            broadcast = lambda x=p_state['bus']:self.broadcast_to_bus(x,{'topic':'misc-sync','data':['has-passcode']})
            reactor.callLater(0,broadcast)        
        
        return passcode20
    set_passcode.require_task = True

    @resource_of_upload(public=False)
    def set_slide_resource(self,request,args,content):
        """
        Upload file to slide as backgrounds
        Called by SBSUser.set_slide_resource() in sbsuser.js
        Arguments:
            args:a dict:
                p: presentation id
                t: thread id
                s: slide idx
                f: flag
        """
        #statetree.log.debug('=====calling set slide by with',args,len(content))
        arg = args[0]
        for name in ('f','p','t','s','n'):#flag, presentation-id, thread-id, slide-idx, filename
            try:
                arg[name]
            except KeyError:
                return {'retcode':1, 'stderr': 'missing '+name}        
        
        flag = arg['f']
        # now, only 2 is supported
        if not flag == 2:
            return {'retcode':2, 'stderr': 'flag error'}
        
        p_id = arg['p']
        t_id = arg['t']
        s_idx = arg['s']
        filename = arg['n']

        try:
            p_state = self.presentation_root_folder.get_presentation_state_token(p_id,flag)
        except:
            traceback.print_exc()
            return {'retcode':3, 'stderr': traceback.format_exc()}
        
        if not p_state:
            return {'retcode':4,'stderr':'presentation error'}
            
        try:
            t_state = p_state['threads'].get(t_id)
            
            if t_state is None:
                return {'retcode':5,'stderr':'no thread of id:%s' % t_id}
            
            # user is not authenticated, if flag and token are validated, we just do it.
            #user = ObjectiveShellSiteRoot.singleton.login_resource.get_user(request)
            #name,ext = os.path.splitext(filename)
            #s_filename = '%s%s' % (abs(hash(name)),ext)
            d = defer.maybeDeferred(self.presentation_root_folder.set_slide_resource, p_state,t_state,s_idx,filename,content)
            my_d = defer.Deferred()
            def okback(slide_resource):
                try:
                    reset_slide_broadcast = lambda bus=p_state['bus'],payload=['bgcolor',t_id,s_idx,slide_resource]:self.broadcast_to_bus(bus,{'topic':'refresh','data':payload})
                    #self._broadcast_throttle[p_state['bus']] = 
                    reactor.callLater(0.5,reset_slide_broadcast)
                    my_d.callback({'retcode':0,'stdout':slide_resource})
                except:
                    traceback.print_exc()
            def errback(failure):
                log.debug('Error:%s' % failure)
                my_d.callback({'retcode':6,'stderr':failure.getErrorMessage()})
            d.addCallbacks(okback,errback)
            
            return my_d
        except:
            return {'retcode':7, 'stderr':traceback.format_exc()} 
    
    @exportable
    def remove_widget_files(self,task,p_id,flag,t_id,uuids):
        try:
            p_state = self.presentation_root_folder.get_presentation_state_token(p_id,flag)
        except:
            traceback.print_exc()
            raise StateError(traceback.format_exc(), retcode=3)
        
        if not p_state:
            raise StateError('presentation error', retcode=4)
        
        self.presentation_root_folder.remove_widget_files(p_state,t_id,uuids)
        return True

    remove_widget_files.require_task = True

    @resource_of_upload(public=False)
    def upload_widget_file(self,request,args,content):
        """
        Upload file to slide for widget's (ImageUnit etc)
        Called by WidgetGallery.upload_widget_file) in widget.js
        Arguments:
            args:a dict:
                p: presentation id
                t: thread id
                s: slide idx
                f: flag
                u: unit's uuid (the unit which the file beloings to)
        """
        #statetree.log.debug('=====calling set slide by with',args,len(content))
        arg = args[0]
        for name in ('f','p','t','s','n','u'):#flag, presentation-id, thread-id, slide-idx, filename, uuid
            try:
                arg[name]
            except KeyError:
                return {'retcode':1, 'stderr': 'missing '+name}        
        
        flag = arg['f']
        # now, only 2 is supported
        if not flag == 2:
            return {'retcode':2, 'stderr': 'flag error'}
        
        p_id = arg['p']
        t_id = arg['t']
        s_idx = arg['s']
        filename = arg['n']
        uuid = arg['u']

        try:
            p_state = self.presentation_root_folder.get_presentation_state_token(p_id,flag)
        except:
            traceback.print_exc()
            return {'retcode':3, 'stderr': traceback.format_exc()}
        
        if not p_state:
            return {'retcode':4,'stderr':'presentation error'}
            
        try:
            t_state = p_state['threads'].get(t_id)
            
            if t_state is None:
                return {'retcode':5,'stderr':'no thread of id:%s' % t_id}
            
            '''
            # 如果檔名太長，先hash，以縮短檔名
            if len(name.encode('utf-8')>19):
                name,ext = os.path.splitext(filename)
                s_filename = '%s%s' % (abs(hash(name)),ext) 
            else:
                s_filename = filename
            '''

            d = defer.maybeDeferred(self.presentation_root_folder.upload_widget_file, p_state,t_state,s_idx,uuid,filename,content)
            my_d = defer.Deferred()
            def okback(filename):
                try:
                    #reset_slide_broadcast = lambda bus=p_state['bus'],payload=['bgcolor',t_id,s_idx,slide_resource]:self.broadcast_to_bus(bus,{'topic':'refresh','data':payload})
                    #reactor.callLater(0.5,reset_slide_broadcast)
                    my_d.callback({'retcode':0,'stdout':filename})
                except:
                    traceback.print_exc()
            def errback(failure):
                log.debug('Error:%s' % failure.getErrorMessage())
                my_d.callback({'retcode':6,'stderr':failure.getErrorMessage()})
            d.addCallbacks(okback,errback)
            
            return my_d
        except:
            return {'retcode':7, 'stderr':traceback.format_exc()} 

    @exportable
    def clone_widget_file(self,task,p_id,flag,t_id,s_idx, uuid,filename):
        """
        複製一份其他unit的圖檔（用於copy widget時）
        從filename 到 uuid
        """
        if not flag == 2:
            return {'retcode':2, 'stderr': 'flag error'}        

        try:
            p_state = self.presentation_root_folder.get_presentation_state_token(p_id,flag)
        except:
            traceback.print_exc()
            return {'retcode':3, 'stderr': traceback.format_exc()}
        
        if not p_state:
            return {'retcode':4,'stderr':'presentation error'}
            
        try:
            t_state = p_state['threads'].get(t_id)
            
            if t_state is None:
                return {'retcode':5,'stderr':'no thread of id:%s' % t_id}
            
            cloned_filename = self.presentation_root_folder.clone_widget_file(p_state,t_state,s_idx,uuid,filename)
            return cloned_filename
        except:
            return {'retcode':7, 'stderr':traceback.format_exc()} 
    clone_widget_file.require_task = True
    
    @resource(public=True)
    def raw_whiteboard(self,request):
        """
        whiteboard version of "def raw"
        retrieve raw data of whiteboard background picture
        """

        for name in (b'p',b'f',b't',b'b'):#flag, presentation-id, thread-id, slide-id
            try:
                request.args[name]
            except KeyError:
                request.setResponseCode(404)
                return b'Not Found'

        p_id = request.args[b'p'][0]
        flag = int(request.args[b'f'][0])
        t_id = request.args[b't'][0]
        bg = request.args[b'b'][0]
        
        if PY3:
            p_id = p_id.decode()
            t_id = t_id.decode()
            bg = bg.decode()
        
        # whiteboard specific flag (speaker screen or audience screen)
        assert flag == 2 or flag == 3

        token = p_id
        p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        
        if not p_state:
            request.setResponseCode(404)
            return b'No Presentation'

        thread_path = get_thread_path(p_state['owner'],p_state['id'],t_id)
        whiteboard_bg_path = os.path.join(thread_path,bg)
        try:
            request.setResponseCode(200)
            mimetype, _ = self.mimetypes.guess_type(whiteboard_bg_path)
            if mimetype:
                request.setHeader(b'content-type',mimetype.encode() if PY3 else mimetype)
            else:
                log.debug('unable to get mimetype of %s' % whiteboard_bg_path)
            request.setHeader(b'content-length',os.stat(whiteboard_bg_path)[stat.ST_SIZE])
            with open(whiteboard_bg_path,'rb') as fd:
                request.write(fd.read())
        except IOError:
            if self.presentation_root_folder.is_cluster_member:
                pass
            else:
                request.setResponseCode(404)
                request.redirect(b'/404.html')
                log.debug('no file:%s' % whiteboard_bg_path)
                return b'file not found'
        reactor.callLater(0,request.finish)

    @resource_of_upload(public=False)
    def add_whiteboard_slide(self,request,args,content):
        """
        Upload file to presentation as slide.
        Called by SBSUser.add_whiteboard_slides() in js
        Arguments:
            args:a dict,
                p: presentation id
                t: thread id
                n: filename (slide bg)
                f: flag
                i: insert at index(optional)
                fo: as focus (optional,default to False)
        Returns:
            a dict,
                s: state of the created slide
                t: state of the created thread when new thread is created
        """       
        arg = args[0]
        for name in ('f','p','t','n'):#flag, presentation-id, thread-id, slide-filename
            try:
                arg[name]
            except KeyError:
                return {'retcode':1, 'stderr': 'missing '+name}        
        
        flag = arg['f']
        p_id = arg['p']
        assert flag == 2
        token = p_id
        p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)

        if not p_state:
            return {'retcode':1,'stderr':'presentation error'}
            
        try:        
            t_id = arg['t']
            stdout = {}
            t_state = p_state['threads'][t_id]
            if t_state is None:
                return {'retcode':1,'stderr':'no thread of id:%s' % t_id}
            
            stdout['t'] = t_state['id']
            
            as_focus = arg.get('fo',False)
            stdout['fo'] = as_focus
            filename,ext = os.path.splitext(arg['n'])
            s_filename = '%s%s' % (abs(hash(filename)),ext)
            insert_at = arg.get('i',-1)
            stdout['i'] = insert_at
            slide_state_obj = self.presentation_root_folder.add_slide_to_t_state(p_state,t_state,s_filename,content, insert_at=insert_at,as_focus=as_focus)
            stdout['s'] = slide_state_obj.state
            
            # 一次增加多個檔案時，client已經改為一個一個增加，每一次都要作bus廣播，所以不作throttle了
            #self.broadcast_to_bus(p_state['bus'],{'topic':'add','data':['slide',stdout]})
            broadcasting = lambda bus=p_state['bus'],payload=stdout:self.broadcast_to_bus(bus,{'topic':'add','data':['slide',payload]})
            reactor.callLater(0.5,broadcasting)

            # browser dont' handle the output (it handles broadcast's data)
            # so, simply return t_id
            return {'retcode':0,'stdout':t_state['id']} 

        except:
            return {'retcode':1, 'stderr':traceback.format_exc()}

    @exportable
    def rename_presentation(self,task,p_id,flag,name):
        # 2019-03-09T08:23:46+00:00 擁有者可以改自己所有簡報名稱，但co-authore也可以改他被授權的簡報
        # 目前已經不打算再用binding的方式，因為概念複雜，使用者不了解
        if flag == 1:
            p_state = self.presentation_root_folder.get_presentation_state(p_id)
            if not (p_state and p_state['owner'] == task.user.username):
                self.throw('no presentation' if p_state is None else 'forbidden')
                return False
        else:
            p_state = self.presentation_root_folder.get_presentation_state_token(p_id,flag)
            if not p_state:
                self.throw('no presentation or forbidden')
                return False

        self.presentation_root_folder.rename_presentation(p_state,name)
        
        #應該廣播給所有在此簡報的user(未必是目前這個使用者所在的簡報)
        self.broadcast_to_bus(p_state['bus'],{'topic':'misc-sync','data':['presentation_name_changed',name]})

        return True
    rename_presentation.require_task = True

    @exportable
    def to_bind(self,task):
        """
        A client request a binder code.
        """
        username_binder = task.user.username
        pd = ProgressDeferred()
        binding_code,valid_until_ts = self.presentation_root_folder.binding_system.to_bind(username_binder,pd)
        if binding_code:
            def waiting_for_approve(_pd):
                _pd.notify([binding_code,valid_until_ts])
            self.callInThread(waiting_for_approve,pd)
            return pd
        else:
            errmsg = valid_until_ts
            raise StateError(message=errmsg, retcode=300)
    to_bind.require_task = True

    @exportable
    def to_unbind(self,task,p_id,flag,userhash):
        """
        unbind, called by binder or owner
        """
        assert flag == 2
        token = p_id
        p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        if userhash:
            #unbind someone by presentation owner
            username_binder = None 
            members = statetree.root.pub.bus.get_members(p_state['bus'])
            # 注意：人數很多時這個作法會很慢
            for username in members:
                m = hashlib.md5()
                m.update(username.encode())
                if m.hexdigest() == userhash:
                    username_binder = username
                    break
            if username_binder is None:
                raise StateError(message='invalid user',retcode=401)
                return
        else:
            #unbind task caller
            username_binder = task.user.internal_metadata['username']

        binded_count = self.presentation_root_folder.binding_system.to_unbind(username_binder)
        if binded_count is None:
            #failed
            raise StateError(message='not binding', retcode=300)
        else:
            # update binded_count to inform binding target to reload if necessary
            unbind_broadcasting = lambda bus=p_state['bus'],x=binded_count:[self.broadcast_to_bus(bus,{'topic':'misc-sync','data':['unbinded',x]}),self._broadcast_throttle.pop(bus,None)]
            self._broadcast_throttle[p_state['bus']] = reactor.callLater(1,unbind_broadcasting)
            # success, inform binder to set cookie
            #cookie = 'sbsbind=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/'+('; domain='+__main__.cookie_domain if __main__.cookie_domain else '')
            #return {'cookie':cookie}
            return True
    to_unbind.require_task = True

    @exportable
    def update_binded_count(self,task):
        """
        called when a binding target received an unbinded event, and it request to update 
        user.metadata['binded']
        """
        username = task.user.username
        binded_count = self.presentation_root_folder.binding_system.get_binded_count(username)
        '''
        if binded_count == 0:
            del task.user.metadata['binded']
        else:
            task.user.metadata['binded'] = binded_count
        '''
        return binded_count
    update_binded_count.require_task = True

    '''
    @exportable
    def to_be_bind(self,task,binder_code):
        username = task.user.username

        #pending: checks for flag to ensure this presentation is in binding phase
        username_binder, pd, binders_count = self.presentation_root_folder.binding_system.to_be_bind(username,binder_code)
        
        if username_binder:

            task.user.metadata['binded'] = binders_count

            # success, inform binder to set cookie
            cookie = 'sbsbind=1; expires=Tue, 19 Jan 2038 04:14:00 GMT; path=/' + ('; domain='+__main__.cookie_domain if __main__.cookie_domain else '')
            pd.callback({'cookie':cookie})
            return binders_count
        else:
            # raise or return an StateError instance either do
            raise StateError(message='invalid binder code',retcode=404)
    to_be_bind.require_task = True
    '''

    @exportable
    def invite_binding(self,task,p_id,flag,invitor,userhash):
        token = p_id
        p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        if not p_state:
            return {'retcode':1,'stderr':'presentation error'}
        if p_state['owner'] != task.user.username:
            return {'retcode':2,'stderr':'not owner error'}

        invitee = None #username of been invited
        members = statetree.root.pub.bus.get_members(p_state['bus'])
        # 注意：人數很多時這個作法會很慢
        for username in members:
            m = hashlib.md5()
            m.update(username.encode())
            if m.hexdigest() == userhash:
                invitee = username
                break
        if invitee is None:
            raise StateError(message='invalid user',retcode=3)#{'retcode':3,'stderr':'user is absent'}
            return
        now = timestamp()
        data = {
            'topic':'_INVITE_BINDING_',
            'data':{
                'invitor':invitor,
            }
        }        
        try:
            statetree.root.pub.bus.unicast(p_state['bus'],invitee,data)
            key = str(flag) + p_id
            try:
                self.invite_binding_queue[key][invitee] = (task.user, now)
            except KeyError:
                self.invite_binding_queue[key] = {invitee : (task.user, now)}
        except:
            traceback.print_exc()
        return True
    invite_binding.require_task = True

    @exportable
    def accept_invite_binding(self,task,p_id,flag):
        token = p_id
        p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        if not p_state:
            raise StateError(message='invalid p_id',retcode=1)

        key = str(flag) + p_id
        now = timestamp()
        invitee_user = task.user
        try:
            invitor_user, ts = self.invite_binding_queue[key][invitee_user.username]
        except KeyError:
            raise StateError(message='no invitor',retcode=100)
        else:
            # +5 for adding flexible period
            if ts - now > 65: return False
            # bind this user to this presentation
            success, binder_count = self.presentation_root_folder.binding_system.bind_to(invitee_user.username,invitor_user.username)
            if success:
                invitee_user.internal_metadata['username'] = invitee_user.username
                invitee_user.username = invitor_user.username
                #invitor_user.metadata['binded'] = binder_count
                # success, inform binder to set cookie
                #cookie = 'sbsbind=1; expires=Tue, 19 Jan 2038 04:14:00 GMT; path=/'+ ('; domain='+__main__.cookie_domain if __main__.cookie_domain else '')
                #return {'cookie':cookie}
                return True
            else:
                raise StateError(message='binding failure',retcode=101)
    accept_invite_binding.require_task = True


    @exportable
    def clear_bindings(self,task,p_id,flag):
        username = task.user.username

        '''
        try:
            task.user.metadata['binded']
        except KeyError:
            # not binding target
            return 
        else:
            assert flag == 2
            token = p_id
            p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
            if p_state is None: return
        '''

        assert flag == 2
        token = p_id
        p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        if p_state is None: return

        success = self.presentation_root_folder.binding_system.clear_bindings(username)
        ''' 未必有用，因為binder device可能沒連進來
        if success:
            # update binded_count to inform binding target to reload if necessary
            cookie = 'sbsbind=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/'+('; domain='+__main__.cookie_domain if __main__.cookie_domain else '')
            unbind_broadcasting = lambda bus=p_state['bus'],x=cookie:[self.broadcast_to_bus(bus,{'topic':'misc-sync','data':['unbinded_all',x]}),self._broadcast_throttle.pop(bus,None)]
            self._broadcast_throttle[p_state['bus']] = reactor.callLater(1,unbind_broadcasting)
        '''
        return success
    clear_bindings.require_task = True

    @cancellable
    @exportable
    def get_quickshortcut_code(self,task, token, flag, code_flag=2):
        if not flag == 2:
            raise StateError(retcode=403,message='invalid access')
        elif not code_flag in (2,3):
            raise StateError(retcode=403,message='invalid access arguments')
        else:
            p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
            if p_state is None:
                raise StateError(retcode=404,message='presentation not found')
            if code_flag == 3:
                token = p_state['acl_token']['as'] # go audience screen
            name = id(task.protocol)
            return self.presentation_root_folder.quickshortcut.get_code(name,token,code_flag)
    get_quickshortcut_code.require_task = True

    @get_quickshortcut_code.disconnection_canceller
    def auto_cancel_quickshortcut(self,task):
        name = id(task.protocol)
        self.presentation_root_folder.quickshortcut.cancel_by_name(name)
    auto_cancel_quickshortcut.require_task = True

    @exportable
    def cancel_quickshortcut(self,token, flag):
        return self.presentation_root_folder.quickshortcut.cancel(token,flag)

    @exportable
    def set_sbs_name(self,task,p_id,flag,sbs_name):
        """
        2019-03-09T09:37:09+00:00
        修改自己的sbsname (display name)

        現在的架構有個情況：
        如果我開了兩個window,一個在自己的版，一個在別人的版，當我從別人的版那裡改名時，自己的版的名字也會更新。
        但如果我從自己的版改名字時，別人的版的window中的那個自己的名字不會被更新。
        """
        assert flag == 2
        token = p_id
        
        current_p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        if current_p_state is None:
            #abnormal
            return

        try:
            username_real = task.user.internal_metadata['username']
        except KeyError:
            username_real = task.user.username
        """
        if not p_state['owner'] == username_real:
            # called by binder 
            ret = self.presentation_root_folder.get_assets(username_real)
            # when set_sbs_name is called, the user's own whiteboard must has created before
            assert len(ret['presentations']) == 1
            p_state = self.presentation_root_folder.get_presentation_state(ret['presentations'][0])
            assert p_state is not None

        if len(sbs_name)==0:
            sbs_name = self.presentation_root_folder.binding_system.create_sbs_name(username_real)
        else:
            self.presentation_root_folder.binding_system.set_sbs_name(username_real,sbs_name)
        """

        if len(sbs_name)==0:
            sbs_name = self.presentation_root_folder.binding_system.create_sbs_name(username_real)
        else:
            self.presentation_root_folder.binding_system.set_sbs_name(username_real,sbs_name)

        # task.user.metadata['name'] is user's (even user is a binder) real sbs_name
        origin_sbs_name = task.user.metadata['name']
        task.user.metadata['name'] = sbs_name
        
        # inform user's sbs_name changed
        self.broadcast_to_bus(current_p_state['bus'],{'topic':'misc-sync','data':['sbs_name_changed',origin_sbs_name,sbs_name]})

        '''
        2019-03-09T09:38:38+00:00 取消此動作

        # 在whiteboard 系統，也將第一個presentation改名
        a_dict = self.presentation_root_folder.get_presentations(username_real)
        if len(a_dict):
            # p_state有可能是None,例如binder因為太久自己的presentation沒使用而被回收
            p_state = None
            if len(a_dict) > 0:
                for p_data in a_dict.values():
                    if p_data['default']:
                        p_id = p_data['id']
                        p_state = self.presentation_root_folder.get_presentation_state(p_id)
                        break
            if p_state:
                self.presentation_root_folder.set_presentation_name(p_state,sbs_name)
                # inform board's name changed
                self.broadcast_to_bus(p_state['bus'],{'topic':'misc-sync','data':['presentation_name_changed',sbs_name]})
        '''
        cookie = 'sbsname='+sbs_name+'; expires=Tue, 19 Jan 2038 04:14:00 GMT; path=/'
        return {'cookie':cookie, 'sbs_name':sbs_name}
    set_sbs_name.require_task = True

    @exportable
    def whois_binding(self,task,p_id, flag):

        assert flag == 2
        token = p_id
        p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        if p_state is None: return

        username = task.user.username
        #binding_info = statetree.root.sidebyside.presentation_root_folder.binding_system.get_binding_info(username)
        binding_info = self.presentation_root_folder.binding_system.get_binding_info(username)
        
        if binding_info is None: return {'binded':None}
        
        # let binders has a chance to update binded name
        broadcasting = lambda bus=p_state['bus'],x=binding_info['binded']:[self.broadcast_to_bus(bus,{'topic':'misc-sync','data':['binded_sbs_name',x]}),self._broadcast_throttle.pop(bus,None)]
        self._broadcast_throttle[p_state['bus']] = reactor.callLater(1,broadcasting)

        return binding_info
    whois_binding.require_task = True

    @exportable
    def who_are_joining(self,task, p_id, flag):
        """
        這個在數量很大時，如果每個人都呼叫一次會很吃力，要想辦法作個cache
        Returns:
            [(sbs_name,userhash,role_flag)*] for owner or binder
                role_flag: 1 for owner, 2 for binder
            [(sbs_name,'',0)*] for others
        """
        assert flag == 2
        token = p_id
        p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        if p_state is None: return
        
        """
        既然 binding 已經暫時取消了，這一段目前用不到
        # 是否有binder
        binded_username = self.presentation_root_folder.binding_system.get_binded_username(p_state['owner'])
        if isinstance(binded_username,list):
            binders = binded_username
        else:
            # bind到別人，或者沒有binder
            binders = None
        """
        binders = None

        request_username = task.user.username
        # binder的username已經跟owner一樣，所以只要測試是否為owner即可
        request_by_owner_binder = (request_username == p_state['owner']) 
        # bus.get_members回傳的是binder原本的username
        joiners = statetree.root.pub.bus.get_members(p_state['bus'])
        ret = []
        for user in joiners:
            sbs_name = user.metadata['name']
            username = user.username
            if request_by_owner_binder:
                m = hashlib.md5()
                m.update(username.encode())
                userhash = m.hexdigest()
                if binders and (username in binders):
                    ret.append([sbs_name, userhash,2])
                elif username == p_state['owner']:
                    ret.append([sbs_name, userhash,1])
                else:
                    ret.append([sbs_name, userhash,0])
            else:
                ret.append([sbs_name, '', 0])
        #print('who are joining',request_username, 'sbsname')
        #print('who is join?',ret,'request_by_owner_binder=',request_by_owner_binder,'user=',request_username ,'owner=', p_state['owner'])
        return ret
    who_are_joining.require_task = True

    @resource(public=True)
    def vscode(self,request):
        """
        Used for VSCode to restore its own whiteboard
        """
        # this route is /@/sidebyside/vscode, so it shoulde ../..
        next_url =  b'../../app/vscode.html'
        try:
            username = request.args.get(b'u')[0]
            ss =  request.args.get(b's')[0]
            sbsname = request.args.get(b'n')[0]
        except TypeError:
            pass
        else:
            expires = 'Tue, 19 Jan 2038 04:14:00 GMT'
            request.addCookie('sbs',username,expires=expires,httpOnly=True,path='/',domain=__main__.cookie_domain)
            request.addCookie('sbsname',sbsname,expires=expires,path='/',domain=__main__.cookie_domain)
            next_url += b'#2'+ss
        request.redirect(next_url)
        return b'ok'
    
    @resource(public=True)
    def forgetme(self,request): 
        """
        清理cookie用途
        this route is /@/sidebyside/forgetme,
        """
        names = (
            'sbs',
            'sbsname',
            #'sbsbind' 不用了
        )
        for name in names:
            expires = 'Thu, 01 Jan 1970 00:00:01 GMT'
            request.addCookie(name,'',expires=expires,httpOnly=True,path='/')
            request.addCookie(name,'',expires=expires,httpOnly=True,path='/',domain=__main__.cookie_domain)
            request.addCookie(name,'',expires=expires,httpOnly=False,path='/')
            request.addCookie(name,'',expires=expires,httpOnly=False,path='/',domain=__main__.cookie_domain)

        # 現在cluster的情況下，不知道使用者是從哪一台登入的，所以不logout了
        #path = self.access_path.encode()
        #path += (b'' if path[-1]==b'/' else b'/') + b'logout'
        #request.redirect(path)

        return b'You are forgetted'
    
    @exportable
    def set_ratio(self, token, flag, w):
        assert flag == 2
        p_state = self.presentation_root_folder.get_presentation_state_token(token,flag)
        if p_state is None: raise StateError(retcode=404,message='presentation not found')
        self.presentation_root_folder.set_ratio(p_state, w)
        self.broadcast_to_bus(p_state['bus'],{'topic':'refresh','data':['ratio',w]})
        return p_state['settings']['ratio']
    '''
    @exportable
    def takeover(self,task):
        assert task.user.username == 'admin'
        self.presentation_root_folder.takeover()
    takeover.require_task = True
    '''
    
    @exportable
    def get_content_type(self,url):
        """
        幫助browser知道某一url的content type(克服 Access-Control-Allow-Origin 問題)
        """
        req = urllib.request.Request(url, method="HEAD")
        try:
            with urllib.request.urlopen(req) as response:
                info = response.info()
                return info.get_content_type()
        except urllib.error.HTTPError:
            return None


statetree.root.add_node('sidebyside',Whiteboard())
