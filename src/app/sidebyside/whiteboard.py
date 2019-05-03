#! python3
import os
import sys
import json
import errno
import hashlib
import logging
import glob
import traceback
import uuid
import re
import time
import shutil
import socket
import base64
import sqlitedict
import random
import __main__
from twisted.python import log
from twisted.internet import reactor, defer
from zope.interface import Interface, implements

from presentation import (
    make_thumbnail,
    get_presentation_path,
    get_thread_path,
    get_slide_path,
    get_slide_thumbnail_path,
    PresentationRootFolder,
    PresentationSqliteDB,
    SlideState,
    slugify,
    get_user_path,
    Overlay,
    BlankResource,
    make_uuid,
    PresentationState,
    timestamp,
    ROOT_FOLDER
)

from cluster import (
    ClusterServerDispatcher,
    FilestoreAgent
)

from objshstate import StateError
#import lycon #generate thumbnail (not PIL based)
PY3 = sys.version_info[0] == 3
try:
    import cPickle as pickle
except ImportError:
    import pickle

# rotate orientation
#from PIL import ExifTags, Image as PILImage
if PY3:
    from io import (StringIO, BytesIO)
else:
    from cStringIO import StringIO

#
# Binding System
# Binding Target (to be bind)
#  * get into a binding phase to allow binding 
#  * in a binding phase, accept a call from browser to verify binder codes
# Binder (to bind)
#  * generate a binder code and ask user to pass it to binding target
#  * when success, receives a cookie to set to browser, (name: sbsbind, value: token of dashboard-sharing)
#    this user will be logout, then request to login again
# Login system
#  * when login, it checks "sbsbind" in advanced of checking "sbs".
#  * for 1) binded user, user.metadata['binded']= <number of binder>
#  * for 2) binder user, user.privatermetadata['username_binder'] = <original username>,  data['binder']= 1
#  * for 3) neigher binded nor binder, as usual
# How to unbind
#  * 
#  * 
# JS how to know it is in a binder environment
#  * by checking sdk.user.metadata.binder == 1 (or missing this value if not binder)
#

class BindingSystem(object):
    """
    Features:
    1. manage binding
    2. auto generate sbs_name
    3. sbs_name's databases 
        3.1 map username to sbs_name
        3.2 map username to last_access_time
    
    binding的方法改為owner從 who is join的清單中點選同意
    """
    def __init__(self,whiteboard_root_folder):
        self.db = whiteboard_root_folder.db
        self.access_path = whiteboard_root_folder.access_path
        
        # 暫時存放binding code，改版 （從 who is join的清單中點選同意）之後不用了
        # self.binding_codes_dict = self.db.binding_codes_dict
        # self.binding_users_dict = {}
        
        # 保持binding的關係，需長存
        # username_binder => username, should be persistent
        # username => [username_binder1, username_binder_2]
        self.binding_dict = self.db.binding_dict

        ''' 主要是維護 binding_codes_dict ， 改版之後不用 binding_codes_dict 了
        # 維護自己的資料
        self.ttl = 5 * 60 # seconds
        self._interval = 60
        reactor.callLater(self._interval,self.do_sanitize)
        '''

        self._throttle_commit_timer = None

        # for picking title
        self.ascii_uppercase = 'ABCDEFGHKLMNPQRSTUVWXYZ' #I,J,O is removed to avoid mixup with digits
        self.digits = '0123456789'

        # 存放sbsname跟username的對應（不知道為何要放在這裡）
        self.sbs_name_dict = self.db.sbs_name_dict

        self._sn_throttle_commit_timer = None
    
    '''
    def to_bind(self,username_binder,pd):
        """
        generate a code for username_binder to bind to other username

        These binder codes are not persistent,
        because of ProgressDeferred are not be able to be persistent.
        """ 
        
        try:
            existing_binding = self.binding_dict[username_binder]
        except KeyError:
            pass
        else:
            if isinstance(existing_binding,list):
                # this username_binder is already been a binding target
                return None,'been binded'

        now = str(timestamp())
        code = None
        #delete existing code 
        try:
            _, _code, access_path = self.binding_codes_dict[username_binder]
            if self.access_path == access_path:
                _, _pd = self.binding_users_dict[_code]
                _pd.errback(StateError(message='cancelled',retcode=1))
                del self.binding_codes_dict[username_binder]
                del self.binding_users_dict[code]
            else:
                # let the _pd in other host to be purged by timeout
                pass
        except KeyError:
            pass
        #generate a unique number
        counter = 0    
        while counter < 10000:
            code = str(100000 + random.randint(0,899999))
            try:
                self.binding_users_dict[code]
                counter += 1
            except KeyError:
                self.binding_codes_dict[username_binder] = (now,code,self.access_path)
                self.binding_users_dict[code] = (username_binder,pd)
                break
        return code,(now+self.ttl)
    '''

    def to_unbind(self,username_binder):
        try:
            username = self.binding_dict[username_binder]
            if isinstance(username,str):
                del self.binding_dict[username_binder]
            else:
                # username_binder is a binding target,
                # it should not call to_unbind
                # this should not happen
                return None #fail
        except KeyError:
            # username_binder is not binding to other username
            # this should not happen
            return None #fail
        else:
            binded_count = 0
            try:
                existing_binding = self.binding_dict[username]
                try:
                    existing_binding.remove(username_binder)
                except ValueError:
                    # username_binder is not binding to this username
                    # this is a database error, should not happen, maybe called twice
                    pass
                else:
                    binded_count = len(existing_binding)
                    if binded_count == 0:
                        del self.binding_dict[username]
                    else:
                        self.binding_dict[username] = existing_binding
            except KeyError:
                pass
            finally:
                self.throttle_commit()
                return binded_count
    def get_binded_count(self,username):
        try:
            return len(self.binding_dict[username])
        except KeyError:
            return 0

    def bind_to(self,username_binder, username_binded):
        try:
            existing_binding = self.binding_dict[username_binded]
            if isinstance(existing_binding,str):
                # reject to be bind, if this username is binding to other
                return False, 0
        except KeyError:
            existing_binding = []

        self.binding_dict[username_binder] = username_binded

        if username_binder not in existing_binding:
            # update reverse binding
            existing_binding.append(username_binder)
            self.binding_dict[username_binded] = existing_binding
        self.throttle_commit()
        return True, len(existing_binding)
    '''
    def to_be_bind(self,username,binder_code):

        try:
            existing_binding = self.binding_dict[username]
            if isinstance(existing_binding,str):
                # reject to be bind, if this username is binding to other
                return None, None,0
        except KeyError:
            existing_binding = []
        
        try:
            username_binder,pd = self.binding_users_dict[binder_code]                
        except KeyError:
            return None,None,0
        else:
            # keep this binding to be persistent(not implemented)                
            self.binding_dict[username_binder] = username
            if username_binder not in existing_binding:
                # update reverse binding
                existing_binding.append(username_binder)
                self.binding_dict[username] = existing_binding
            self.throttle_commit()

            del self.binding_users_dict[binder_code]
            del self.binding_codes_dict[username_binder]
            
            return username_binder, pd, len(existing_binding)
    '''
    
    ''' 主要是維護 binding_codes_dict ， 改版之後不用 binding_codes_dict 了
    def do_sanitize(self):
        """
        do garbage collection on cached codes
        """
        now = timestamp()
        expired_binder_ids = []
        ttl = self.ttl
        
        for _binder_id, value in self.binding_codes_dict.items():
            # str(ts), pd, access_path = value
            if not value[2] == self.access_path: continue
            if now - int(value[0]) > ttl:
                expired_binder_ids.append((_binder_id,value[1]))
        for _binder_id,_code in expired_binder_ids:
            _, _pd = self.binding_users_dict[_code]
            del self.binding_codes_dict[_binder_id]
            del self.binding_users_dict[_code]
            _pd.errback(StateError(message='timeout',retcode=1))
        reactor.callLater(self._interval,self.do_sanitize)
    '''

    def get_binded_username(self,username_binder):
        try:
            return self.binding_dict[username_binder]
        except KeyError:
            #log.debug('map failed',self.binding_dict.keys(), username_binder)
            return None

    def isbinder(self,username_binder,username):
        try:
            existing_binders = self.binding_dict[username]
            if isinstance(existing_binders, list):
                return username_binder in existing_binders
            else:
                return False
        except KeyError:
            return False
    
    def clear_bindings(self,username):
        try:
            existing_binders = self.binding_dict[username]
            if isinstance(existing_binders, list):
                del self.binding_dict[username]
                for username_binder in existing_binders:
                    del self.binding_dict[username_binder]
                self.throttle_commit()
                return True
            else:
                #log.debug('there is no bindng to ',username,'existing_binders=',existing_binders)
                return False
        except KeyError:
            log.debug('there is no bindng record of ',username)
            return False
   
    def throttle_commit(self):
        """
        call this, instead of call self.binding_dict.commit()

        call self.binding_dict.commit at least per 3s
        """
        if self._throttle_commit_timer: return
        def t():
            self._throttle_commit_timer = None
            self.binding_dict.commit()
        self._throttle_commit_timer = reactor.callLater(3,t)

    def get_binding_info(self,username):
        try:
            existing_binders = self.binding_dict[username]
        except KeyError:
            return None
        
        if not isinstance(existing_binders, list):
            return None
        #convert to sbs_name
        ret = {'binded':self.get_sbs_name(username),'binders':[]}
        for username_binder in existing_binders:
            ret['binders'].append(self.get_sbs_name(username_binder))
        return ret

    #
    # sbs_name management starts
    #
    def create_sbs_name(self,username_real):
        """
        這是產生使用者名稱（流水號），借放在這裡而已，與binding system 無關
        format: [A-Z]000000
        """

        """ 直接取亂數就好，暫時取消 (2019/1/5)
        key = '_last_user_title_'
        try:
            v = self.binding_dict[key]
        except KeyError:
            n = 1
        else:
            n = int(v[0]) + 1
        # elasticsearch 要求要相同類型所以n轉成str
        self.binding_dict[key] = [str(n)]
        self.throttle_commit()
        """
        n = random.randint(0,9999)
        sbs_name = ''.join(random.choices(self.ascii_uppercase+self.digits,k=2))+str(n).zfill(4)
        self.set_sbs_name(username_real,sbs_name)
        return sbs_name
    
    def sbs_name_throttle_commit(self):
        """
        call this, instead of call self.sbs_name_dict.commit()

        call self.sbs_name_dict.commit at least per 3s
        """
       
        if self._sn_throttle_commit_timer: return
        def t():
            self._sn_throttle_commit_timer = None
            self.sbs_name_dict.commit()
        self._sn_throttle_commit_timer = reactor.callLater(0,t) 

    def set_sbs_name(self,username,sbs_name):
        #log.msg('set sbsname', username, sbs_name)
        self.sbs_name_dict[username] = sbs_name
        self.sbs_name_throttle_commit()
    def get_sbs_name(self,username):
        try:
            return self.sbs_name_dict[username]
        except KeyError:
            #log.debug('failed to get username of',username)
            #log.debug('keys=',list(self.sbs_name_dict.keys()))
            return None

class Quickshortcut(object):
    def __init__(self,whiteboard_root_folder):
        self.db = whiteboard_root_folder.db
        self.codes = self.db.quickshortcut_codes_dict
        self.pids = self.db.quickshortcut_pids_dict
        self.names = {} # 此dict一定是在本機使用
        self.ttl = 60
        self._maintain_interval = 600
        self._maintain_timer = reactor.callLater(self._maintain_interval, self._maintain)
    
    def _maintain(self):
        #清除逾時的shortcut code
        now = timestamp()
        expired_n = []
        for n, (key, timeout_str) in self.codes.items():
            if now > int(timeout_str):
                expired_n.append(n)        
                del self.pids[key]
        for n in expired_n:
            del self.codes[n]
        self._maintain_timer = reactor.callLater(self._maintain_interval, self._maintain)
    
    def get_code(self,name,token,flag):
        #generate a unique number
        key = str(flag)+token
        try:
            n = self.pids[key]
        except KeyError:
            pass
        else:
            del self.codes[n]
        
        counter = 0
        now = timestamp()
        code = -1
        while counter < 10000:
            n = str(100000 + random.randint(0,899999))
            counter += 1
            try:
                self.codes[n]
            except KeyError:
                self.codes[n] = [key, str(now+self.ttl)]
                self.pids[key] = n
                code = n
                break
        # 假設name跟key不會有相同的name space
        self.names[name] = key
        self.names[key] = name
        return code
    
    def cancel(self,token,flag):
        key = str(flag)+token
        try:
            n = self.pids[key]
        except KeyError:
            pass
        else:
            del self.pids[key]
            try:
                del self.codes[n]
            except KeyError:
                pass
        
        try:
            name = self.names[key]
        except KeyError:
            pass
        else:
            del self.names[key]
            try:
                del self.names[name]
            except KeyError:
                pass
        return True
    
    def cancel_by_name(self,name):
        try:
            key = self.names[name]
        except KeyError:
            return False
        else:
            flag = int(key[0])
            token = key[1:]
            return self.cancel(token,flag)

    def resolve_code(self,n):
        try:
            key, timeout_str = self.codes[n]
        except KeyError:
            return None, None
        else:
            flag = int(key[0])
            token = key[1:]
            if timestamp() < int(timeout_str):
                return token, flag
            else:
                self.cancel(token,flag)
                return None, None
            
class WhiteboardSqliteDB(PresentationSqliteDB):
    # idle over 5 min, p_state will be removed from cache
    def __init__(self,path):
        super(WhiteboardSqliteDB,self).__init__(path)

        for name,autocommit in (
            ('binding_dict',False),
            ('sbs_name_dict',False)
            ):
            self.make_dict(name,for_cache=False,autocommit=autocommit)
        
        for name in (
            'delegate_host_dict', # sqlitedict is not used for cluster, so we don't need to provide this dict
            'available_host_dict', # sqlitedict is not used for cluster, so we don't need to provide this dict
            'active_count_dict',
            'quickshortcut_codes_dict', # 單機版不需要quickshortcut 的資料persistant
            'quickshortcut_pids_dict',  # 單機版不需要quickshortcut 的資料persistant
            ):
            self.make_dict(name,for_cache=True)

        # create db for binding system
        #sbs_name_dict_flag = 'c'
        # set flag to n to sanity database, flat = c is normal state
        #binding_dict_flag = 'c'
        #self.binding_dict_path = os.path.join(self.path,'user_binding.dict')
        #self.sbs_name_dict_path = os.path.join(self.path,'user_sbs_name.dict')
        #self.binding_dict = sqlitedict.SqliteDict(self.binding_dict_path,autocommit=False,flag=binding_dict_flag)
        #self.sbs_name_dict =  sqlitedict.SqliteDict(self.sbs_name_dict_path,autocommit=False,flag=sbs_name_dict_flag)
        
        # 避免執行錯誤的資料庫
        #if binding_dict_flag == 'n' or sbs_name_dict_flag == 'n':
        #    def breakout():
        #        log.debug('!'*20,'Binding System database rebuild completed(flag=n)')
        #        reactor.stop()
        #    reactor.callLater(3, breakout)
        #reactor.callLater(self.states_cache_timeout, self._maintain_presentation_states_cache)
    

if __main__.config.whiteboard_cluster['enable']:
    from elasticsearchbackend import PresentationElasticSearchDB, ElasticSearchIndex
    class WhiteboardElasticSearchDB(PresentationElasticSearchDB):
        _singleton = None
        def __init__(self,*args,**kw):
            assert WhiteboardElasticSearchDB._singleton is None
            super(WhiteboardElasticSearchDB,self).__init__(*args,**kw)
            WhiteboardElasticSearchDB._singleton = self
            # do config.py a favor:
            # retrieve cluster settings from the elasticsearch server
            key = 'stores' # see setcluster.py for "key"
            self.binding_dict = ElasticSearchIndex(self.es,'binding_dict')
            self.sbs_name_dict = ElasticSearchIndex(self.es,'sbs_name_dict')
            
            # global session pool
            #self.session_dict = ElasticSearchIndex(self.es,'session_dict')
        @classmethod
        def singleton(cls):
            return WhiteboardElasticSearchDB._singleton

    """
    這一塊程式碼是為了實作跨主機的帳號登入系統用於binding系統。由於binding系統可能不是必要的，
    因此暫時不實作了。 (2019/1/15)

    from twisted.web.server  import Request, Site, Session
    class ClusterSession(Session):
        sessionTimeout = 900

        _expireCall = None
        
        dict = None
        def __init__(self, site, uid, reactor=None):
            super(ClusterSession,self).__init__(site,uid,reactor)
            
            if ClusterSession.dict is None:
                ClusterSession.dict = WhiteboardElasticSearchDB.singleton().session_dict
            
            #add to cluster db
            try:
                ClusterSession.dict[self.uid] += 1
            except KeyError:
                ClusterSession.dict[self.uid] = 1
        
        def expire(self):
            super(ClusterSession,self).expire()
            # delete cluster session
            try:
                n = ClusterSession.dict[self.uid]
            except KeyError:
                pass
            else:
                if n > 1:
                    ClusterSession.dict[self.uid] = n - 1
                else:
                    del ClusterSession.dict[self.uid]
        
        def touch(self):
            self.lastModified = self._reactor.seconds()
            if self._expireCall is not None:
                self._expireCall.reset(self.sessionTimeout)
        
    #
    # Monkey-patch Request.getSession to add "httpOnly" to session cookie
    # And store then into elasticsearch (這樣才能做到一台unbind,所有台都unbind)
    #
    Site.sessionFactory = ClusterSession

    def makeSession(self,uid=None):
            if uid is None:
                uid = self._mkuid()
                        
            session = self.sessions[uid] = self.sessionFactory(self, uid)
            session.startCheckingExpiration()
            return session
    Site.makeSession = makeSession
    

    def getSession(self, sessionInterface=None, forceNotSecure=False):
        # Make sure we aren't creating a secure session on a non-secure page
        secure = self.isSecure() and not forceNotSecure

        if not secure:
            cookieString = b"TWISTED_SESSION"
            sessionAttribute = "_insecureSession"
        else:
            cookieString = b"TWISTED_SECURE_SESSION"
            sessionAttribute = "_secureSession"

        session = getattr(self, sessionAttribute)

        # Session management
        if not session:
            cookiename = b"_".join([cookieString] + self.sitepath)
            sessionCookie = self.getCookie(cookiename)
            if sessionCookie:
                try:
                    session = self.site.getSession(sessionCookie)
                except KeyError:
                    pass
            # if it still hasn't been set, fix it up.
            if not session:
                session = self.site.makeSession(sessionCookie)
                self.addCookie(cookiename, session.uid, path=b"/",
                            secure=secure, httpOnly=True) ## patched

        session.touch()
        setattr(self, sessionAttribute, session)

        if sessionInterface:
            return session.getComponent(sessionInterface)

        return session
    Request.getSession = getSession
    """




class WhiteboardRootFolder(PresentationRootFolder):    
    def __init__(self,db):
        super(WhiteboardRootFolder,self).__init__(db)
        self.is_cluster_member = __main__.config.whiteboard_cluster['enable']
        if self.is_cluster_member:
            # 以 access_path當成self.host在cluster當中的ID，作為註冊之用
            # 此值也會透過/@/sidebyside/config傳回browser當中使用於連線到指定的host
            self.host = __main__.config.whiteboard_cluster['name']

            filestone_options = __main__.config.whiteboard_cluster['filestore']
            filestore_module_path = filestone_options['module_path']
            sys.path.insert(0,filestore_module_path)
            local_folder = os.path.join(__main__.config.folder['var'],'rootfolder','guest')
            assert os.path.exists(local_folder),'filestore path not found: %s' % local_folder
            log.info('watching folder:%s' % local_folder)
            if 0:
                socketclient_options = filestone_options['socketclient']
                from socketclient import SocketClient
                self.filestore_agent = FilestoreAgent(SocketClient(self.host,local_folder,socketclient_options))
            else:
                # 如果filestore就是本機，則remote_folder可設定成None，此時不會進行檔案傳輸
                # 在此情況時，其他member server要mount的目錄，是本機的member server的var/rootfolder/guest目錄
                remote_folder = filestone_options['repository_mount_path']
                
                from mountclient import MountClient
                self.filestore_agent = FilestoreAgent(MountClient(self.host,local_folder,remote_folder))
            
            sys.path.remove(filestore_module_path)
            self.access_path = __main__.config.whiteboard_cluster['access_path']
            weight = __main__.config.whiteboard_cluster['weight']
        else:
            self.host = None
            if __main__.config.general['daemon']['http']['enable']:
                self.access_path = __main__.config.general['daemon']['http']['access_path']
            else:
                self.access_path = __main__.config.general['daemon']['https']['access_path']
            weight = 1
        self.binding_system = BindingSystem(self)
        self.server_dispatcher = ClusterServerDispatcher(self.host, self.access_path, self.db, weight)
        self.quickshortcut = Quickshortcut(self)
    
    def get_presentations(self,username):
        """
        To provide browser all presentations of a single user
        returns: a dict of presentations
        
        2019-03-08T09:34:57+00:00
        因whiteboar決定提供可創建多個簡報的功能而生的函式
        """
        ret = self.db.user_presentation_dict.get(username)
        if isinstance(ret,list):
            # covert old-style data structure @2019-03-08T10:11:12+00:00
            p_dict = {}
            for p_id in ret:
                p_dict[p_id] = {
                    'default':True,
                    'ctime':int(time.time()),
                    'name':''
                }
            return p_dict
        else:
            return ret
    
    def create_presentation(self,username,name,immediately_sync=False):
        # 策略：
        #   使用者一定有一個預設的簡報
        #   新建立的簡報一定是預設的簡報
        #   預設的簡報被刪除時，任意挑選一個當預設的簡報
        #   使用者只有一個簡報時，不能刪除該簡報

        p_dict = self.db.user_presentation_dict.get(username) or {}
        
        # 2019-03-11T07:05:27+00:00 目前限制最多10個；正常來講GUI會擋住，所以只簡單返回None
        if len(p_dict) >= 10: return None

        p_state = PresentationState(self,username,name).state
        # default to enable speaker screen in whiteboard
        self.set_bus_room_id(p_state)
        self.start_speaker_screen(p_state)

        if isinstance(p_dict,list):
            # 2019-03-10T06:02:00+00:00
            # 改成新版的dict 格式
            new_p_dict = {}
            for p_id in p_dict:
                new_p_dict[p_id] = {
                    'default': False # is user's default presentation or not
                    ,'ctime':0 # time of creation, note:last-modification time is in p_state
                    ,'name':''
                }
            p_dict = new_p_dict
        
        ctime = int(time.time())
        p_data = {
            'default':True if len(p_dict)==0 else False,
            'ctime':ctime,
            'name':name
        }
        p_dict[p_state['id']] = p_data
        # note: user_presentation_dict is auto commit
        self.db.user_presentation_dict[username] = p_dict

        # 放一份userhash與token到user_presentation_dict去
        # 當作此使用者預設的 presentation，目的如下：
        # 為什麼要有這個數值呢？因為當剛喬治要取得瑪麗的簡報時,
        # 喬治並不知道那個簡報的TOKEN也不知道瑪麗的username的token他只能知道瑪麗的userename的hash value 
        if p_data['default']:
            m = hashlib.md5()
            m.update(username.encode())
            self.db.user_presentation_dict[m.hexdigest()] = {2:p_state['acl_token']['ss']}

        #自動啟用audience screen
        self.start_audience_screen(p_state)
        t_state = self.add_thread_to_p_state(p_state,'A')
        slide_state = self.add_blank_slide_to_t_state(p_state,t_state)

        # 立刻寫入資料庫 miso
        self.on_presentation_changed(p_state,immediately_sync)

        # cauton: review what is this value for ?(2019-03-10T06:15:30+00:00)
        n = self.db.statistic_dict['presentation']
        self.db.statistic_dict['presentation'] = n+1
        
        return {'ctime':ctime,'p_state':p_state}

    def rename_presentation(self,p_state,name):
        p_state['name'] = name
        self.on_presentation_changed(p_state)

        # 更新使用者所有簡報的清單
        p_dict = self.db.user_presentation_dict.get(p_state['owner'])
        if isinstance(p_dict,list):
            # 改成新版的dict 格式
            new_p_dict = {}
            count = 0
            for p_id in p_dict:
                count += 1
                new_p_dict[p_id] = {
                    'default': True if count == 0 else False # is user's default presentation or not
                    ,'ctime':0 # time of creation, note:last-modification time is in p_state
                    ,'name':''
                }
            p_dict = new_p_dict
        
        p_dict[p_state['id']]['name'] = name
        p_dict[p_state['id']]['default'] = True
        # note: user_presentation_dict is auto commit
        self.db.user_presentation_dict[p_state['owner']] = p_dict

    def remove_presentation(self,p_state):
        """
        Return:
            default_p_id: (string) p_id of user default presentation
        """        
        #更新使用者所擁有的presentation清單
        p_dict = self.db.user_presentation_dict[p_state['owner']]

        # 至少要有一個簡報，否則不進行刪除
        if len(p_dict) <= 1: return False

        p_id = p_state['id']
        if isinstance(p_dict,list):
            # 改成新版的dict 格式
            new_p_dict = {}
            count = 0
            ctime = int(time.time())
            for _p_id in p_dict:
                if _p_id == p_id: continue
                if count == 0:
                    new_default_p_id = _p_id
                    default = True
                else:
                    default = False
                new_p_dict[_p_id] = {
                    'default': default
                    ,'ctime':ctime # time of creation, note:last-modification time is in p_state
                    ,'name':''
                }
                count += 1
            p_dict = new_p_dict
        else:
            if p_dict[p_id]['default']:
                # take new default presentation
                for _p_id,_p_data in p_dict.items():
                    if _p_id == p_id: continue
                    new_default_p_id = _p_id
                    break
                print('set dfault prese to',new_default_p_id)
                p_dict[new_default_p_id]['default'] = True
                new_default_p_state = self.get_presentation_state(new_default_p_id)
                m = hashlib.md5()
                m.update(new_default_p_state['owner'].encode())
                self.db.user_presentation_dict[m.hexdigest()] = {2:new_default_p_state['acl_token']['ss']}
            else:
                # assign value to new_default_p_id
                for _p_id,_p_data in p_dict.items():
                    if _p_data['default']:
                        new_default_p_id = _p_id
                        break
                    break
            del p_dict[p_id]

        self.db.user_presentation_dict[p_state['owner']] = p_dict

        #presentation_states_cache
        # 清除檔案
        try:
            shutil.rmtree(os.path.join(get_user_path(p_state['owner']),p_id))
        except OSError:
            log.debug('failed to rmdir %s' % (os.path.join(get_user_path(p_state['owner']),p_id)))
                
        # 更新token與presentation對照表（含其cache)
        token_tainted = False
        for _, token in p_state['acl_token'].items():
            if token is not None:
                try:
                    del self.db.token_presentation_dict[token]
                    token_tainted = True
                except KeyError:
                    pass
                try:
                    del self.db.token_presentation_cache[token]
                except KeyError:
                    # this token has not been loaded into memory
                    pass
        if token_tainted:
            self.db.token_presentation_dict.commit()
        
        # self.on_presentation_removed 會清理 self.db.presentation_states_dict 
        # 跟 self.db.presentation_states_cache, 然後bus與p_id的對照表self.db.bus_presentation_cache[p_state['bus']]
        # 會在 _maintain_presentation_states_cache 當中被清除
        self.db.on_presentation_removed(p_id)

        return new_default_p_id

    def set_presentation_default(self,p_state):
        # 更新使用者所有簡報的清單
        p_dict = self.db.user_presentation_dict.get(p_state['owner'])
        if isinstance(p_dict,list):
            # 改成新版的dict 格式
            new_p_dict = {}
            ctime = int(time.time())
            for p_id in p_dict:
                new_p_dict[p_id] = {
                    'default': False
                    ,'ctime':ctime
                    ,'name':''
                }
            p_dict = new_p_dict        
            p_dict[p_state['id']]['default'] = True
        else:
            for p_id, p_data in p_dict.items():
                if p_id == p_state['id']:
                    p_data['default'] = True
                else:
                    p_data['default'] = False
        # note: user_presentation_dict is auto commit
        self.db.user_presentation_dict[p_state['owner']] = p_dict

        m = hashlib.md5()
        m.update(p_state['owner'].encode())
        self.db.user_presentation_dict[m.hexdigest()] = {2:p_state['acl_token']['ss']}

        return True

    def forget_me(self,username):
        """
        清除資料庫與檔案系統的所有紀錄
        """
        p_dict = self.db.user_presentation_dict[username]
        # 清除所有的簡報
        for p_id in p_dict.keys():
            # 清除簡報檔案
            try:
                shutil.rmtree(os.path.join(get_user_path(username),p_id))
            except OSError:
                log.debug('failed to rmdir %s' % (os.path.join(get_user_path(username),p_id)))

            p_state = self.get_presentation_state(p_id)

            # 更新token與presentation對照表（含其cache)
            for _, token in p_state['acl_token'].items():
                if token is not None:
                    try:
                        del self.db.token_presentation_dict[token]
                    except KeyError:
                        pass
                    try:
                        del self.db.token_presentation_cache[token]
                    except KeyError:
                        # this token has not been loaded into memory
                        pass
            self.db.token_presentation_dict.commit()
            
            # self.on_presentation_removed 會清理 self.db.presentation_states_dict 
            # 跟 self.db.presentation_states_cache, 然後bus與p_id的對照表self.db.bus_presentation_cache[p_state['bus']]
            # 會在 _maintain_presentation_states_cache 當中被清除
            self.db.on_presentation_removed(p_id)

        # 清除使用者預設簡報的對應資料
        m = hashlib.md5()
        m.update(username.encode())
        del self.db.user_presentation_dict[m.hexdigest()]

        return len(p_dict)

    def add_blank_slide_to_t_state(self,p_state,t_state,color='FFFFFF',insert_at=-1,as_focus=True,update_db=True):
        # create an instance of SlideState
        max_id = max([int(x['id']) for x in t_state['slides']]) if len(t_state['slides']) else 0
        s_id = str(max_id+1)
        slide_state = SlideState(t_state,s_id)
        slide_state.resource['color'] = color

        s_state = slide_state.state

        if insert_at == -1 or insert_at >= len(t_state['slides']):
            t_state['slides'].append(s_state)
        else:
            t_state['slides'].insert(insert_at, s_state)
        
        if as_focus:
            # set default slide_index to this slide
            # (this is different from sidebyside, it set this new slide to be default slide
            # only if this is the only slide of this thread)
            p_state['thread_settings'][t_state['id']]['slide_id'] = s_id
        
        #set to default layout when 1st presentation is created
        #if p_state['presentation_layout']['panels']['main'] is None:
        #    p_state['presentation_layout']['panels']['main'] = t_state['id']
        if not p_state['settings']['focus']:
            p_state['settings']['focus'] = t_state['id']
        
        if update_db:
            #self.db.update_presentation_state_cache(p_state['id'],p_state)
            self.on_presentation_changed(p_state)
        return slide_state
    
    '''
    def reset_slide_of_id(self,username,p_state,t_id,s_id):
        """
        available for whiteboard.
        """
        s_state_to_reset = None 
        for _s_state in p_state['threads'][t_id]['slides']:
            if not _s_state['id'] == s_id: continue
            s_state_to_reset = _s_state
            break
        if s_state_to_reset is None:
            return None
        else:
            # remove background and thumbnail of this slide
            self.remove_slide_bg(username, p_state,t_id,s_idx)
            _color = s_state_to_reset['resource']['color']
            s_state_to_reset['resource'] = BlankResource(None).state
            s_state_to_reset['resource']['color'] = _color          
            s_state_to_reset['overlay'] = Overlay(None).state
            s_state_to_reset['zoom'] = [1,0,0]
            s_state_to_reset['translate'] = [0,0]
            s_state_to_reset['extra'] = None

            self.db.update_presentation_state_cache(p_state['id'],p_state)
            return s_state_to_reset
    '''

    def reset_slides_of_idx(self,p_state,t_id,s_idxes):
        """
        available for whiteboard. (清除投影片內容，但保留底色)
        """
        def search_unit_uuid(root_units,uuids):
            for unit_obj in root_units:
                print('found uuid',unit_obj['id'])
                uuids.append(unit_obj['id']) #all id of unit is uuid(v4)
                try:
                    search_unit_uuid(unit_obj['units'],uuids)
                except KeyError:
                    pass

        t_path = get_thread_path(p_state['owner'],p_state['id'],t_id) # thread's path

        changed_s_states = []
        paths_to_remove = []
        for s_idx in s_idxes:
            try:
                s_state = p_state['threads'][t_id]['slides'][s_idx]
            except IndexError:
                continue

            s_state['overlay'] = Overlay().state
            s_state['zoom'] = [1,0,0]
            s_state['translate'] = [0,0]
            s_state['extra'] = None

            # remove background and thumbnail of this slide
            #s_id = s_state['id']
            self.remove_slide_bg(p_state,t_id,s_idx)

            # also clean widgets up
            # collect widget's units files
            uuids = []
            for widget_obj in s_state['widgets']:
                try:
                    widget_obj['units']
                except KeyError:
                    print('!!!!no units: ',list(widget_obj.keys()))
                    continue
                search_unit_uuid(widget_obj['units'],uuids)
            for uuid in uuids:
                paths_to_remove.extend(glob.glob(os.path.join(t_path,uuid+'.*')))
            s_state['widgets'] = []

            s_state['resource'] = BlankResource(None).state
            s_state['resource']['color'] = 'FFFFFF' #default to white
    
            changed_s_states.append([s_idx,s_state])
        
        if len(changed_s_states):
            #self.db.update_presentation_state_cache(p_state['id'],p_state)
            self.on_presentation_changed(p_state)
        
        for path in paths_to_remove:
            try:
                print('reset slide unlinked path',path)
                os.unlink(path)
            except OSError:
                print('warning:reset slide unlink path failed:',path)
                pass
        return changed_s_states

    def reset_slide_background(self,p_state,t_id,s_idxes):
        """
        清除投影片底圖（本地檔案或者URL)
        """

        t_path = get_thread_path(p_state['owner'],p_state['id'],t_id) # thread's path

        changed_s_states = []
        for s_idx in s_idxes:
            try:
                s_state = p_state['threads'][t_id]['slides'][s_idx]
            except IndexError:
                continue

            # remove background and thumbnail of this slide
            #s_id = s_state['id']
            self.remove_slide_bg(p_state,t_id,s_idx)

            s_state['resource'] = {
                'type':'BLANK',
                'color': s_state['resource']['color'],
                'bg':'',
                #'extra':None
            }
            #print('>>>remove bg',s_state['resource'])
            changed_s_states.append([s_idx,s_state])
        
        if len(changed_s_states):
            self.on_presentation_changed(p_state)
        
        return changed_s_states

    def on_refresh(self,u_id,room_id, data):
        p_id = self.db.bus_presentation_cache[room_id]
        p_state = self.get_presentation_state(p_id)
        if data[0] == 'bgcolor':
            t_id, s_idx = data[1:3]
            s_state = p_state['threads'][t_id]['slides'][s_idx]
            for key,value in data[3].items():
                try:
                    #ensure key is not arbitary
                    s_state['resource'][key]
                    s_state['resource'][key] = value
                except KeyError:
                    pass
        elif data[0] == 'text-wrap':
            t_id, s_idx = data[1:3]
            s_state = p_state['threads'][t_id]['slides'][s_idx]
            s_state['resource']['wrap'] = data[3]
        elif data[0] == 'scroll':
            t_id, s_idx = data[1:3]
            s_state = p_state['threads'][t_id]['slides'][s_idx]
            s_state['resource']['scroll'] = [data[3],data[4]]
        elif data[0] == 'text-hilight':
            t_id, s_idx = data[1:3]
            s_state = p_state['threads'][t_id]['slides'][s_idx]
            line_no, hilight = data[3], data[4]
            if hilight:
                try:
                    s_state['resource']['hilight'].index(line_no)
                except ValueError:
                    s_state['resource']['hilight'].append(line_no)
            elif line_no == -1:
                del s_state['resource']['hilight'][:]
            else:
                try:
                    s_state['resource']['hilight'].remove(line_no)
                except ValueError:
                    pass
        else:
            # do not call self.db.update_presentation_state_cache()
            return 
        #self.db.update_presentation_state_cache(p_id,p_state)
        self.on_presentation_changed(p_state)

    def set_presentation_passcode(self,p_state,passcode):        
        # passcode is not used for reverse lookup, so it is not necessary to 
        # update self.token_presentation_dict and self.token_presentation_cache
        p_state['acl_token']['ps'] = passcode
        #self.db.update_presentation_state_cache(p_state['id'],p_state)
        self.on_presentation_changed(p_state)

    def set_slide_resource(self,p_state,t_state,s_idx,filename,content):
        #blank_slide_state = SlideState(p_state['threads'][t_id],s_id).state
        username = p_state['owner']
        if not filename: return None
        s_state = t_state['slides'][s_idx]
        slide_state = SlideState(t_state,s_state['id'],s_state)
        slide_resource_state = slide_state.set_resource(p_state,t_state,filename, content)
        if slide_resource_state:
            #self.db.update_presentation_state_cache(p_state['id'],p_state)
            self.on_presentation_changed(p_state)
        return slide_resource_state

    def upload_widget_file(self,p_state,t_state,s_idx,uuid,filename,content):
        username = p_state['owner']
        if not (uuid and filename): return None
        s_state = t_state['slides'][s_idx]
        slide_state = SlideState(t_state,s_state['id'],s_state)
        filename = slide_state.add_file(p_state,t_state,uuid,filename, content)
        return filename
    
    def clone_widget_file(self,p_state,t_state,s_idx,uuid,filename):
        username = p_state['owner']
        if not (uuid and filename): return None
        s_state = t_state['slides'][s_idx]
        slide_state = SlideState(t_state,s_state['id'],s_state)
        filename = slide_state.clone_file(p_state,t_state,uuid,filename)
        return filename

    def remove_widget_files(self,p_state,t_id,uuids):
        #
        # 將widget的unit上傳的檔案刪除（client刪除了此些units)
        # 假設一個unit只有一個檔案
        #
        username = p_state['owner']
        t_path = get_thread_path(username,p_state['id'],t_id)
        
        files = []
        for uuid in uuids:
            # 先清掉相同uuid的檔案，此檔案必定以uuid開頭
            files.extend(glob.glob(os.path.join(t_path,uuid+'.*')))

        for file in files:
            os.unlink(file)
            print('>>> remove unit file',file)                

    def remove_slide_bg(self,p_state,t_id,s_idx):
        """
        刪除slide背景圖（本地的檔案）
        """
        owner = p_state['owner']
        t_path = get_thread_path(owner,p_state['id'],t_id)
        
        #s_state = None
        #for _s_state in p_state['threads'][t_id]['slides']:
        #    if _s_state['id'] == s_id:
        #        s_state = _s_state
        #        break
        try:
            s_state =  p_state['threads'][t_id]['slides'][s_idx]
        except IndexError:
            return False
        
        # remove file of current backbround
        existing_filename = s_state['resource']['bg']
        if existing_filename:
            try:
                os.unlink(os.path.join(t_path,existing_filename))
            except OSError:
                log.warn('slide bg not found:%s' % os.path.join(t_path,existing_filename))
                # not existed
                pass
        # remove current file of thumbnail
        thumbnail_path = os.path.join(t_path,s_state['id']+'.t.jpg') 
        try:
            os.unlink(thumbnail_path)
        except OSError:
            log.warn('slide thumbnail not found:%s' % thumbnail_path)
            pass

        s_state['resource']['bg'] = ''

        self.on_presentation_changed(p_state)
        return True

    def remove_slides_of_id(self,username, p_state,t_id,s_ids):
        raise Exception('remove_slides_of_id is deprecated')
    '''
    def deprecated_remove_slides_of_id(self,username, p_state,t_id,s_ids):
        """
        Whiteboard's version of remove_slides_of_id, this implement knows 
        to remove background and thumbnail of a whiteboard slide.
        """
        t_state = p_state['threads'][t_id]
        s_states_to_remove = []
        paths_to_remove = []

        curr_s_id = p_state['thread_settings'][t_id]['slide_id']
        find_new_s_id = True if curr_s_id in s_ids else False
        # set current slide to the previous slide of current slide 
        # or the next slide if current is the 1st slide
        new_s_id = [find_new_s_id,None]
        for s_state in t_state['slides']:
            if not s_state['id'] in s_ids:
                if new_s_id[0]: new_s_id[1] = s_state['id']
                continue
            s_states_to_remove.append(s_state)
            if s_state['id'] == curr_s_id: new_s_id[0] = False
        
        for s_state in s_states_to_remove:
            t_state['slides'].remove(s_state)

            #remove thumbnail
            paths_to_remove.append(get_slide_thumbnail_path(username,p_state['id'],t_id,s_state['id']))

            #remove img resource
            if s_state['resource']['type'] == 'IMG':
                paths_to_remove.append(get_slide_path(username,p_state['id'],t_id,s_state['id']))
            elif s_state['resource']['type'] == 'Whiteboard' and s_state['resource']['bg']:
                paths_to_remove.append(os.path.join(get_thread_path(username,p_state['id'],t_id),s_state['resource']['bg']))

        for path in paths_to_remove:
            try:
                os.unlink(path)
            except OSError:
                #log.debug('removing nonexisting file:%s' % path)
                pass

        # reset focus to another slide_id
        if find_new_s_id:
            if new_s_id[1]:
                p_state['thread_settings'][t_id]['slide_id'] = new_s_id[1]
            else:
                p_state['thread_settings'][t_id]['slide_id'] = t_state['slides'][0]['id'] if len(t_state['slides']) else None

        #self.db.update_presentation_state_cache(p_state['id'],p_state)
        self.on_presentation_changed(p_state)

        return p_state['thread_settings'][t_id]['slide_id']
    '''

    def remove_slides_of_idx(self,p_state,t_id,s_idxes):
        """
        Whiteboard's version of remove_slides_of_idx, this implement knows 
        to remove background and thumbnail of a whiteboard slide.
        """
        username = p_state['owner']
        s_idxes.sort()
        s_idxes.reverse()

        t_state = p_state['threads'][t_id]
        s_states_to_remove = []
        paths_to_remove = []

        curr_s_id = p_state['thread_settings'][t_id]['slide_id']
        #find_new_s_id = True if curr_s_id in s_ids else False
        find_new_s_idx = False
        # set current slide to the previous slide of current slide 
        # or the next slide if current is the 1st slide
        #new_s_id = [find_new_s_id,None]
        for idx in s_idxes:
            s_state = t_state['slides'][idx]
            if s_state['id'] == curr_s_id:
                find_new_s_idx = True
            s_states_to_remove.append(s_state)
        
        # deletion starts
        def search_unit_uuid(root_units,uuids):
            for unit_obj in root_units:
                print('found uuid',unit_obj['id'])
                uuids.append(unit_obj['id']) #all id of unit is uuid(v4)
                try:
                    search_unit_uuid(unit_obj['units'],uuids)
                except KeyError:
                    pass

        t_path = get_thread_path(username,p_state['id'],t_id) # thread's path
        for s_state in s_states_to_remove:
            t_state['slides'].remove(s_state)
            #collect thumbnail
            paths_to_remove.append(get_slide_thumbnail_path(username,p_state['id'],t_id,s_state['id']))

            #collect img resources
            if s_state['resource']['type'] == 'IMG':
                paths_to_remove.append(get_slide_path(username,p_state['id'],t_id,s_state['id']))
            elif s_state['resource']['type'] == 'BLANK' and s_state['resource']['bg']:
                paths_to_remove.append(os.path.join(t_path,s_state['resource']['bg']))

            #collect widgets
            uuids = []
            for widget_obj in s_state['widgets']:
                search_unit_uuid(widget_obj['units'],uuids)
            for uuid in uuids:
                paths_to_remove.extend(glob.glob(os.path.join(t_path,uuid+'.*')))
        for path in paths_to_remove:
            try:
                os.unlink(path)
            except OSError:
                #log.debug('removing nonexisting file:%s' % path)
                pass

        # reset focus to another slide_id
        new_s_idx = -1
        if find_new_s_idx:
            min_s_idx = min(s_idxes)
            if min_s_idx == 0:
                new_s_idx = 0
            else:
                new_s_idx = min_s_idx - 1

            p_state['thread_settings'][t_id]['slide_id'] =  t_state['slides'][new_s_idx]['id']

        #self.db.update_presentation_state_cache(p_state['id'],p_state)
        self.on_presentation_changed(p_state)
        
        return new_s_idx
    
    def add_slide_to_t_state(self,p_state,t_state,s_filename,content,insert_at,as_focus):
        """
        reimplementation for whiteboard        
        """
        # create an instance of SlideState
        update_db = False
        color = 'FFFFFF' #default background color
        slide_state = self.add_blank_slide_to_t_state(p_state,t_state,color,insert_at,as_focus,update_db)
        slide_state.set_resource(p_state,t_state,s_filename,content)
        return slide_state

    # called when bus received zoom-sync (data format changed in whiteboard)
    def on_zoom_sync(self,u_id,room_id,data):
        p_id = self.db.bus_presentation_cache[room_id]
        t_id, s_idx = data[0:2]
        p_state = self.get_presentation_state(p_id)
        #pending: check u_id == p_state['owner'] here
        s_state = p_state['threads'][t_id]['slides'][s_idx]
        s_state['zoom'] = data[2:] #[scale, [offsetX, offsetY],[translateX, translateY]]

        # this is lazy implement to check data[2:] == [1,0,0] (aka reset_rooming)
        # when reset_zooming, also reset translate
        #if sum(data[2:]) == 1:
        s_state['translate'] = data[4]
       
        #self.db.update_presentation_state_cache(p_id,p_state)
        self.on_presentation_changed(p_state)

    def on_widget_save(self,u_id,room_id, data):
        """
        When client calls "send_to_bus('widget-save',[t_id, s_idx, payload])"
        """
        #on, t_id, s_idx, data = data
        p_id = self.db.bus_presentation_cache[room_id]
        t_id, s_idx, payload = data[0:3]
        p_state = self.get_presentation_state(p_id)
        #pending: check u_id == p_state['owner'] here
        s_state = p_state['threads'][t_id]['slides'][s_idx]
        s_state['widgets'] = payload
        self.on_presentation_changed(p_state)

    def set_presentation_name(self,p_state,sbs_name):
        p_state['name'] = sbs_name
        #self.db.update_presentation_state_cache(p_state['id'],p_state)
        self.on_presentation_changed(p_state)
    
    def set_ratio(self,p_state, w):
        print('set ratio::',p_state['settings']['ratio'][0] ,'==>', w)
        if p_state['settings']['ratio'][0] == w: return True # do  nothing
        if w == 4:
            p_state['settings']['ratio'][0] = 4
            p_state['settings']['ratio'][1] = 3
        else:
            p_state['settings']['ratio'][0] = 16
            p_state['settings']['ratio'][1] = 9
        self.on_presentation_changed(p_state)
        return True
    
    #
    # cluster admin related routines
    #
    def get_delegate_host(self,ss_token=None):
        if self.is_cluster_member:
            return self.server_dispatcher.get_delegate_host(ss_token)
        else:
            return None
    def update_delegate_host(self,access_path,ss_token):
        return self.server_dispatcher.update_delegate_host(access_path,ss_token)
    def increase_active_count(self):
        # maintain the self.server_dispatcher.active_count
        self.server_dispatcher.increase_active_count()
        print('>>>>active + >',self.server_dispatcher.active_count_dict[self.server_dispatcher.access_path]['count'])
    def decrease_active_count(self):
        # maintain the self.server_dispatcher.active_count
        self.server_dispatcher.decrease_active_count()
        print('>>>>active - >',self.server_dispatcher.active_count_dict[self.server_dispatcher.access_path]['count'])
    
    def handover_to_hosts(self,hosts_not_to_takeover=None,hosts_to_takeover=None):
        self.server_dispatcher.handover_to_hosts(self,osts_not_to_takeover,hosts_to_takeover)
    def takeover_from_host(self,hosts_not_to_takeover=None,hosts_to_takeover=None):
        self.server_dispatcher.takeover_from_host(self)

        