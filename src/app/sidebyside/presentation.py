#! -*- coding:utf-8 -*-
# 2018/11/18
#   start to implement elasticseach-backend
#   implementation has moved to elasticsearchbackend.py
#
import os
import sys
import json
import errno
import logging
import traceback
import uuid
import re
import time
import shutil
import socket
import base64
import sqlitedict
import glob
import __main__
from twisted.python import log
from twisted.internet import reactor, defer
from zope.interface import Interface, implements
#import lycon #generate thumbnail (not PIL based)
PY3 = sys.version_info[0] == 3

assert PY3, 'whiteboard system runs in Python3 only'

try:
    import cPickle as pickle
except ImportError:
    import pickle

from io import (StringIO, BytesIO)


from backend import BackendDatabase

def slugify(filename): 
    """
    注意：即使filename相同，不保證每次回傳的名字都一樣（因為取hash的關係）

    1. Convert string to a safe name for filename. 
    2. convert long name (over 19char) to short name
    Rules:
    1. lowercase, 
    2. remove leading .. and /\:*?<>|" in any position
    3. shink continous . and - to one
    
    Returns: an unicode
    """
    assert isinstance(filename,str)
    #import unicodedata
    #value = unicodedata.normalize('NFKD', value)#.encode('utf-8', 'ignore')
    # remove leading .. and /\:*?<>|" in any position
    filename = re.sub('(^\.+|[\s\/\\\:\*\?\<\>\|\"])',r'',filename).strip().lower()
    # convert continous . and - to one
    filename = re.sub('([\.-]){2,}', r'\1', filename)

    # 如果檔名太長，先hash，以縮短檔名
    if len(filename.encode('utf-8')) > 19:
        name,ext = os.path.splitext(filename)
        filename = '%s%s' % (abs(hash(name)),ext) 
    return filename

def timestamp():
    return int(time.time()) + __main__.tzoffset

# whiteboard make this longer
def make_uuid(length=16):
    # return a str type
    return (base64.urlsafe_b64encode(os.urandom(length)).rstrip(b'=')).decode()

ROOT_FOLDER = os.path.normpath(os.path.abspath(os.path.join(__main__.config.folder['var'],'rootfolder')))

if not os.path.exists(ROOT_FOLDER):
    os.mkdir(ROOT_FOLDER)

def get_user_path(username):
    kind = 'guest'
    #foldername = slugify(username) #get ride of kind
    foldername = username #username is base64-urlsafe encoded, no need to slugify
    return os.path.join(ROOT_FOLDER,kind,foldername) 
def get_presentation_path(username,p_id):
    return os.path.join(get_user_path(username),p_id)
def get_thread_path(username,p_id,t_id):
    return os.path.join(get_presentation_path(username,p_id),t_id)
def get_slide_path(username,p_id,t_id,s_id):
    return os.path.join(get_thread_path(username,p_id,t_id),s_id)
def get_slide_thumbnail_path(username,p_id,t_id,s_id):
    #filename,_ext = os.path.splitext(slugify(s_id))
    return os.path.join(get_thread_path(username,p_id,t_id),s_id+'.t.jpg')

"""
Use lycon
def make_thumbnail(src_path,dst_path):
    #lycon does not accept unicode in path name
    if isinstance(src_path,unicode):
        src_path = src_path.encode('utf-8')
    if isinstance(dst_path,unicode):
        dst_path = dst_path.encode('utf-8')
    src_img = lycon.load(src_path)
    # src_img of lycon is a binaray array
    src_width = len(src_img[0]); src_height=len(src_img) 
    dst_img = lycon.resize(src_img,width=100,height=round(100.0/src_width*src_height),interpolation=lycon.Interpolation.CUBIC)
    lycon.save(dst_path,dst_img)
""" 
# Use Pillow
from PIL import ExifTags, Image as PILImage
def make_thumbnail(src_path,dst_path):
    try:
        if PY3:
            pass
        else:
            if isinstance(src_path,unicode):
                src_path = src_path.encode('utf-8')
            if isinstance(dst_path,unicode):
                dst_path = dst_path.encode('utf-8')
        img = PILImage.open(src_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        width = 300
        height = int(round(float(width) / img.size[0] * img.size[1]))
        dst_img = img.resize((width,height),PILImage.BILINEAR)
        dst_img.save(dst_path)
    except:
        traceback.print_exc()

def normalize_image(s_fd, s_path,s_thumbnail_path,max_size=2048.0):
    """
    Args:
        max_size: max width or height, if max_size==0, keep original size
    """
    image_tainted = False
    image = None
    if max_size > 0 :
        image=PILImage.open(s_fd)
        # rotate orientation if necessary
        '''
        for orientation in ExifTags.TAGS.keys():
            if ExifTags.TAGS[orientation]=='Orientation':
                break
        #print('orientation=',[orientation])
        ''' 
        orientation = 274 # a constant 0x112
        rotation = 0
        try: 
            exif=dict(image._getexif().items())
            if exif[orientation] == 3:
                rotation = 180
            elif exif[orientation] == 6:
                rotation = 270
            elif exif[orientation] == 8:
                rotation = 90        
        except (AttributeError, KeyError, IndexError):
            # cases: image don't have getexif
            pass

        if not rotation == 0:
            image=image.rotate(rotation, expand=True)
            image_tainted = True

        # reduce size if necessary
        width, height = image.size
        if (width > max_size or height > max_size):
            width = float(width)
            height = float(height)
            if  width > height:
                new_width = max_size
                new_height = int(max_size / width * height)
            else:
                new_height = max_size
                new_width = int(max_size / height * width)
            image = image.resize((int(new_width),int(new_height)),PILImage.ANTIALIAS)
            image_tainted = True
    
    # 確認這個目錄存在，因為有可能在cleanup時被刪除了
    folder = os.path.dirname(s_path)
    if not os.path.exists(folder):
        os.makedirs(folder)
    if image_tainted:
        image.save(s_path)
    else:
        if image is None: image = PILImage.open(s_fd)
        s_fd.seek(0)
        fd = open(s_path,'wb')
        fd.write(s_fd.read())
        fd.close()

    if s_thumbnail_path:
        #make thumbnail
        if image.mode == 'RGBA':
            image = image.convert('RGB')
        width = 300
        height = int(round(float(width) / image.size[0] * image.size[1]))
        dst_img = image.resize((width,height),PILImage.BILINEAR)
        if dst_img.mode == 'RGBA':
            # 不太理解為了上面已經轉過一次，resize之後還會有"OSError: cannot write mode P as JPEG"的錯誤
            # 再轉一次試看看。
            dst_img = dst_img.convert('RGB')
        dst_img.save(s_thumbnail_path)
        dst_img.close()

    image.close()
    
    return True

#this implementation really works in wider scenario
#REF:https://stackoverflow.com/questions/166506/finding-local-ip-addresses-using-pythons-stdlib
def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

class PresentationSqliteDB(BackendDatabase):
    def __init__(self,path,*args,**kw):
        super(PresentationSqliteDB,self).__init__()
        self.path = path
        
        for name,autocommit in (
            ('user_presentation_dict',True), #存放使用者與簡報的對應關係
            ('presentation_states_dict',False), #存放簡報跟他的內容的對應關係
            ('token_presentation_dict',False), #存放憑證對應到簡報的關係
            ('presentation_atime_dict',False), #存放簡報跟他最後存取時間的對應關係
            ('presentation_widget_dict',False), #存放簡報跟他的道具的對應關係；暫時不實作
            ('statistic_dict',True), # 存放幾個長存的counter
            ):
            self.make_dict(name,for_cache=False,autocommit=autocommit)
        
        # initialize statistic_dict (這兩個是計算數量用的，也是長存的)
        for key in ('username','presentation'):
            try:
                self.statistic_dict[key]
            except KeyError:
                self.statistic_dict[key] = 0

        
        # handover_data_dict 用不到了
        #for name in (
        #    'handover_data_dict',
        #    ):
        #    self.make_dict(name,for_cache=True)

        # 每5秒鐘回存一次 presentation_states_dict
        self._commit_timer = None
        self._commit_timeout = 5
        self._commit_ts = 0 #last commit time
    
    def make_dict(self,name,for_cache=True,**kw):
        try:
            getattr(self,name)
            raise Exception(name+' already existed as %s' % getattr(self,name))
        except AttributeError:
            if for_cache:
                setattr(self,name,{})
            else:
                dict_path = os.path.join(self.path,name+'.sqt')
                autocommit = kw.get('autocommit',False)
                setattr(self,name,sqlitedict.SqliteDict(dict_path,autocommit=autocommit))
            return getattr(self,name)        
        
    #
    # implemetation of internally data model management starts
    # to maintain presentation_states_dict
    def _commit(self):
        self._commit_timer = None
        self.presentation_states_dict.commit()

    def _on_sqlitedict_tainted(self):
        # a throttle to call self._commit() to update presentation_states_dict
        if self._commit_timer: return
        self._commit_timer = reactor.callLater(self._commit_timeout,self._commit)
       
    def update_presentation_state(self,p_id, p_state, sync=False):
        """
        Update the p_state in both self.presentation_states_cache and self.presentation_states_dict
        And, write back to sqlitdict
        Args:
            sync:(boolean) 若為真，立刻更新（刪除操作時，自動為真，例如創建新的presentation時可使用，以在不同主機之間同步）;
        """        
        if p_state is None:
            del self.presentation_states_dict[p_id]
            sync = True
        else:
            self.presentation_states_dict[p_id] = p_state
        
        if sync:
            self.presentation_states_dict.commit()
        else:
            self._on_sqlitedict_tainted()
    

class PresentationRootFolder(object):
    """
    Been modified in whiteboard system
    """
    def __init__(self,db):
        assert isinstance(db,BackendDatabase),'db_factory is %s' % db_factory
        self.db = db
        # IP Address
        self.hostname = get_ip()
        """
        # keep the user's data
        # 1. self.user_presentation_dict is  
        #    {username => list of presentation id}
        self.user_presentation_path = os.path.join(self.path,'user_presentation.dict')
        self.user_presentation_dict = sqlitedict.SqliteDict(self.user_presentation_path,autocommit=False)
        #log.msg('users:\n%s' % '\n'.join(self.user_presentation_dict.keys()),LoggingLevel=logging.DEBUG)
        # 2. self.presentation_dict is 
        #    {presentation_id => presentation_metadata} (relatively static data)
        self.presentation_states_path = os.path.join(self.path,'presentations.dict')
        self.presentation_states_dict = sqlitedict.SqliteDict(self.presentation_states_path,autocommit=False)
        # 3. self.presentation_dict_cache is
        #    the same as presentation_dict but in memory
        self.presentation_states_cache = {}

        # 4. self.token_presentation_dict is
        #   token => (presentation_id, flag) where flag is 2(ss token) or 3(sa token)
        self.token_presentation_path = os.path.join(self.path,'token_presentations.dict')
        self.token_presentation_dict = sqlitedict.SqliteDict(self.token_presentation_path,autocommit=False)
        # cached version of self.token_presentation_dict
        self.token_presentation_cache = {}

        # 5. self.bus_presentation_dict is
        #   bus_room_id => presentation_id
        #   its content is build together with self.presentation_states_cache
        self.db.bus_presentation_cache = {}

   
        #runtime variables
        self._commit_timer = None
        self._commit_timeout = 5
        self._commit_ts = 0 #last commit time
        """
    def on_presentation_changed(self,p,sync=False):
        self.db.on_presentation_changed(p,sync)

    #
    # Services to browser starts
    #
    '''
    def get_assets(self,username):
        """
        2019-03-08T09:55:02+00:00
        注意：應該改用 get_presentations(self,username) in whiteboard.py

        To provide browser all presentations of a single user
        """
        # username(from uid) is generated token,
        # it has prefix ':g00:'(for geust) or ':m00:'(for member)
        return {
            'presentations':self.db.user_presentation_dict.get(username) or []
        }
    '''

    def create_presentation(self,username,name):
        """
        注意：此routine已經過期；不要使用
        """
        raise NotImplementedError('Do not call me')
        
        p_state = PresentationState(self,username,name).state
        # default to enable speaker screen
        self.set_bus_room_id(p_state)
        # 自動啟用speaker screen
        self.start_speaker_screen(p_state)

        p_list = self.db.user_presentation_dict.get(username) or []
        p_list.append(p_state['id'])
        self.db.user_presentation_dict[username] = p_list
        # 這裡不會馬上commit 資料庫，因為可能後續還要做一些設定，
        # 呼叫者要在做完所要的初始設定之後再呼叫 self.on_presentation_changed(p_state, True)
        # 這樣就會立刻commit
        self.on_presentation_changed(p_state)
        return p_state

    def get_presentation_state(self,p_id):
        """
        Returns reference to the state of presentation from cache
        or load it into cache
        """
        now  = timestamp()
        try:
            p_state_cached = self.db.presentation_states_cache[p_id]
            p_state_cached[1] = now #touch this cache item
            return p_state_cached[0]
        except KeyError:
            try:
                p_state = self.db.presentation_states_dict[p_id]
            except KeyError:
                return None
            else:
                # restore the p_state into cache and bus-cache
                self.db.presentation_states_cache[p_id] = [p_state,now]
                self.db.bus_presentation_cache[p_state['bus']] = p_id
                self.db.presentation_atime_dict[p_id] = now
                # this function is directly called by presentation's owner only, 
                # so, we don't load acl tokens into self.token_presentation_cache here.
            return p_state

    def get_presentation_state_token(self,token, flag):
        """
        Returns reference to the state of presentation from cache by flag(of token)
        or load it into cache.
        
        If token or flag is wrong, returns None.

        1.把token+flag換成p_id，2.再把p_id用 self.get_presentation_state()換成p_state
        1 這一步驟會用到 token_presentation_cache 跟 token_presentation_dict
        2 這一步驟會用到 presentation_states_cache 跟 presentation_states_dict
        在 2 時，也會把 p_state['bus'] 寫到 bus_presentation_cache

        """
        # flag is 1,2,3,4 only
        if not (0 < flag < 5): return None 
        flag = str(flag)
        try:
            value = self.db.token_presentation_cache[token]
            p_id_flag, _ = value
            # if flag mismatch, return None
            if p_id_flag[1] != flag:
                return None
            value[1] = timestamp()
        except KeyError:
            # load and put into cache
            try:
                p_id_flag = self.db.token_presentation_dict[token]
            except KeyError:
                return None
            else:
                # if flag mismatch, return None
                if p_id_flag[1] != flag:
                    return None
                # write to cache
                self.db.token_presentation_cache[token] = [p_id_flag,timestamp()]
        return self.get_presentation_state(p_id_flag[0])
    
    ''' where comes the "flag"? maybe obsoleted
    def get_presentation_state_bus(self,room_id):
        """
        Returns reference to the state of presentation by bus_room_id
        """
        try:
            value = self.db.token_presentation_cache[token]
            p_id_flag, _ = value
            # if flag mismatch, return None
            if p_id_flag[1] != flag: return None
            value[1] = timestamp()
        except KeyError:
            try:
                p_id_flag = self.db.token_presentation_dict[token]
                # if flag mismatch, return None
                if p_id_flag[1] != flag: return None
                self.db.token_presentation_cache[token] = [p_id_flag,timestamp()]
            except KeyError:
                return None
        return  self.get_presentation_state(p_id_flag[0])
    '''
    
    '''
    # 2019-03-10T07:39:54+00:00 新的實作見whiteboard.py
    def remove_presentation(self,p_state):
        raise NotImplementedError('Obsoleted code been caleed')
        # presentation is p_state
        # 清除檔案
        p_id = p_state['id']
        try:
            shutil.rmtree(os.path.join(get_user_path(p_state['owner']),p_id))
        except OSError:
            log.debug('failed to rmdir %s' % (os.path.join(get_user_path(p_state['owner']),p_id)))
        
        #更新使用者所擁有的presentation清單
        p_list = self.db.user_presentation_dict[p_state['owner']]
        p_list.remove(p_id)
        
        if len(p_list):
            self.db.user_presentation_dict[p_state['owner']] = p_list
        else:
            del self.db.user_presentation_dict[p_state['owner']]            
        
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
        # 更新 bus與p_id的對照表
        del self.db.bus_presentation_cache[p_state['bus']]
        # miso
        # self.on_presentation_removed 會清理 self.db.presentation_states_dict 跟 self.db.presentation_states_cache
        self.db.on_presentation_removed(p_id)
    '''

    def remove_thread(self,p_state,t_id):
        """
        remove thread of t_id from presentation of p_state.
        by operatation on p_state instead of presentation instance.

        Returns: the thread id of new focus thread (could be None, if there is no thread)
        """
        # remove thread's path
        shutil.rmtree(os.path.join(get_user_path(p_state['owner']),p_state['id'],t_id))
        
        # assign a new focus thread by
        # updating presentations' thread_settings
        t_ids = sorted(p_state['thread_settings'].keys())
        
        '''
        if len(t_ids) == 1:
            # assign focus thread to None
            p_state['presentation_layout']['panels']['main'] = None
        else:
            # assign focus thread to previous or next thread
            idx = t_ids.index(t_id)
            p_state['presentation_layout']['panels']['main'] = t_ids[1] if idx == 0 else t_ids[idx-1] 
        '''

        del p_state['thread_settings'][t_id]
        del p_state['threads'][t_id]
        self.on_presentation_changed(p_state)
        
        # new focus t_id
        if len(t_ids) == 1:
            p_state['settings']['focus'] = ''
        else:
            idx = t_ids.index(t_id)
            p_state['settings']['focus'] = t_ids[1] if idx == 0 else t_ids[idx-1]
        return p_state['settings']['focus']


    def remove_slides_of_id(self,p_state,t_id,s_ids):
        """
        This implmentation could be forgot to remove image and thumbnail.
        (found when developing whiteboard)
        """
        t_state = p_state['threads'][t_id]
        s_states_to_remove = []

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

        # reset focus slide_id
        if find_new_s_id:
            if new_s_id[1]:
                p_state['thread_settings'][t_id]['slide_id'] = new_s_id[1]
            else:
                p_state['thread_settings'][t_id]['slide_id'] = t_state['slides'][0]['id'] if len(t_state['slides']) else None

        self.on_presentation_changed(p_state)
        
        return p_state['thread_settings'][t_id]['slide_id']



    # called when bus received slide-sync  
    def on_slide_sync(self,u_id,room_id,t_id,s_idx,extra_resource_data):
        p_id = self.db.bus_presentation_cache[room_id]
        p_state = self.get_presentation_state(p_id)
        s_state = p_state['threads'][t_id]['slides'][s_idx]
        s_state['resource']['extra'] = extra_resource_data
        p_state['thread_settings'][t_id]['slide_id'] = s_state['id']
        p_state['settings']['focus'] = t_id
        self.on_presentation_changed(p_state)

    # called when bus received zoom-sync
    def on_zoom_sync(self,u_id,room_id,data):
        p_id = self.db.bus_presentation_cache[room_id]
        t_id, s_idx = data[0:2]
        p_state = self.get_presentation_state(p_id)
        #pending: check u_id == p_state['owner'] here
        s_state = p_state['threads'][t_id]['slides'][s_idx]
        s_state['zoom'] = data[2:] #[scale, offsetX, offsetY]

        # this is lazy implement to check data[2:] == [1,0,0] (aka reset_rooming)
        # when reset_zooming, also reset translate
        if sum(data[2:]) == 1:
            s_state['translate'] = [0,0]
       
        self.on_presentation_changed(p_state)

    def on_translate_sync(self,u_id,room_id,data):
        p_id = self.db.bus_presentation_cache[room_id]
        t_id, s_idx = data[0:2]
        p_state = self.get_presentation_state(p_id)
        #pending: check u_id == p_state['owner'] here
        s_state = p_state['threads'][t_id]['slides'][s_idx]
        s_state['translate'] = data[2:] #[pos1,pos2]
       
        self.on_presentation_changed(p_state)
    
    # called when bus received draw-sync
    def on_draw_sync(self,u_id,room_id,data):
        p_id = self.db.bus_presentation_cache[room_id]
        #t_id, s_id ,layer_id, [w,h,x0,y0,x1,y2,x2,y2,...] = payload['data']
        p_state = self.get_presentation_state(p_id)
        assert p_state
        action = data[0]
        t_id, s_idx, layer_idx = data[1:4]
        if action == 'draw':
            t_id, s_idx = data[1:3]
            #pending: check u_id == p_state['owner'] here
            s_state = p_state['threads'][t_id]['slides'][s_idx]        
            s_state['overlay']['layers'][layer_idx].append(data[4])
        elif action == 'clear':
            s_state = p_state['threads'][t_id]['slides'][s_idx]
            del s_state['overlay']['layers'][layer_idx][:]
        elif action == 'erase':
            s_state = p_state['threads'][t_id]['slides'][s_idx]
            chunks = s_state['overlay']['layers'][layer_idx]
            #data[4] = color, width, height, numberOfPoints, x0,y0, last_x, last_y (on_draw_erase())
            color, width, height, length, x0,y0, last_x, last_y = data[4]
            for i in range(len(chunks)):
                #//color, alpha, storke width, width, height, x of first point , y of first point, x1, y1, ....
                chunk = chunks[i]
                if  chunk[0] == color and chunk[3] == width and chunk[4] == height and len(chunk) == (length*2+5) and \
                    chunk[5] == x0 and chunk[6] == y0 and \
                    chunk[-2] == last_x and chunk[-1] == last_y:
                    del chunks[i]
                    break

        self.on_presentation_changed(p_state)
    
    # called when bus received misc-sync
    def on_misc_sync(self,u_id,room_id, data):
        """
        """
        
        #目前是個無用的函式(2018/12/26)
        return 

        try:
            p_id = self.db.bus_presentation_cache[room_id]
        except KeyError:
            assert room_id == '__ALL__'
            pass
        else:
            p_state = self.get_presentation_state(p_id)
            tainted = False
            """ no more overlay:visible been fired
            if data[0] == 'overlay:visible':
                t_id, s_idx = data[1:3]
                s_state = p_state['threads'][t_id]['slides'][s_idx]
                s_state['overlay']['visible'] = data[3]
                tainted = True
            """
            if tainted: self.on_presentation_changed(p_state)
    #
    # ACL token related implementation starts
    #
    def set_bus_room_id(self,p_state):
        # re-create a new room_id for presentations' bus
        self.bus = make_uuid(16)
        p_state['bus'] = self.bus
        
        self.db.bus_presentation_cache[p_state['bus']] = p_state['id']        
        self.on_presentation_changed(p_state)

    def start_speaker_screen(self,p_state):
        #already done, do nothing
        if (p_state['acl_token']['ss']):
            return  p_state['acl_token']['ss']
        
        #re-create a new set of ss and as
        token = make_uuid()
        p_state['acl_token']['ss'] = token
        # flag 2 for ss
        value = [p_state['id'],'2']
        self.db.token_presentation_dict[token] = value
        self.db.token_presentation_dict.commit()
        self.db.token_presentation_cache[token] = [value,timestamp()]
        
        self.on_presentation_changed(p_state)
        return p_state['acl_token']['ss']
    
    def shutdown_speaker_screen(self, p_state):
        token = p_state['acl_token']['ss']
        p_state['acl_token']['ss'] = None
        
        del self.db.token_presentation_dict[token]
        self.db.token_presentation_dict.commit()
        try:
            del self.db.token_presentation_cache[token]
        except KeyError:
            pass

        # call self.update_presentation_state_cache()
        # if it is not called in self.shutdown_audience_screen()
        if not self.shutdown_audience_screen(p_state):
            self.on_presentation_changed(p_state)

    def start_audience_screen(self,p_state):
        
        if p_state['acl_token']['as']:
            return p_state['acl_token']['as']

        token =  make_uuid()
        p_state['acl_token']['as'] = token

        # flag 3 for as
        value = [p_state['id'],'3']
        self.db.token_presentation_dict[token] = value
        self.db.token_presentation_dict.commit()
        self.db.token_presentation_cache[token] = [value,timestamp()]

        self.on_presentation_changed(p_state)

        return token

    def shutdown_audience_screen(self,p_state):
        token = p_state['acl_token']['as']
        if not token: return False
        p_state['acl_token']['as'] = None

        del self.db.token_presentation_dict[token]
        self.db.token_presentation_dict.commit()
        try:
            del self.db.token_presentation_cache[token]
        except KeyError:
            pass
        
        self.on_presentation_changed(p_state)
        return True
    
    def start_dashboard_sharing(self,p_state):
        
        if p_state['acl_token']['ds']:
            return p_state['acl_token']['ds']
        
        token = make_uuid()
        p_state['acl_token']['ds'] = token

        # flag 4 for ds
        value = [p_state['id'],'4']
        self.db.token_presentation_dict[token] = value
        self.db.token_presentation_dict.commit()
        self.db.token_presentation_cache[token] = [value,timestamp()]

        self.on_presentation_changed(p_state)

        return token

    def shutdown_dashboard_sharing(self, p_state):
        token = p_state['acl_token']['ds']
        p_state['acl_token']['ds'] = None

        del self.db.token_presentation_dict[token]
        self.db.token_presentation_dict.commit()
        try:
            del self.db.token_presentation_cache[token]
        except KeyError:
            pass

        self.on_presentation_changed(p_state)
    # End of ACL token related implementation

    def add_thread_to_p_state(self,p_state,t_name):
        """
        Add a thread into p_state without create a FSPresentation instance
        """
        # find max available index
        t_state = ThreadState(p_state,t_name).state
        
        # if thread failed to create, it's id is None
        if not t_state['id']: return None
        
        p_state['threads'][t_state['id']] = t_state
        
        #if len(p_state['threads'])==1 and len(t_state['slides']):
        #    # if this is the only thread, let it to be default thread
        #    p_state['presentation_layout']['panels']['main'] = t_state['id']
        #    #self._refresh_thumbnail_of_presentation(p_state)
        
        if len(p_state['threads'])==1:
            # if this is the only thread, let it to be default thread
            p_state['settings']['focus'] = t_state['id']

        p_state['thread_settings'][t_state['id']] = {'slide_id':t_state['slides'][0]['id'] if len(t_state['slides']) else None}
        
        #update parent's state
        self.on_presentation_changed(p_state)
        
        return t_state
    '''
    def add_slide_to_t_state(self,p_state,t_state,s_id,content,insert_at=None):
        """
        id is filename, so, same file will be replaced
        """
        _,ext = os.path.splitext(s_id)
        assert ext ,'unusual slide id:%s' % s_id
        # save contents to a savable name in file system s_id is usually set to filename
        filename = slugify(s_id)
        t_path = get_thread_path(p_state['owner'],p_state['id'],t_state['id'])
        name,ext = os.path.splitext(filename)
        ext = ext.upper()
        if ext == '.JSON':
            # resource_state is uploaded as a file content
            # so, it is not written to file
            try:
                resource_state = json.loads(content)
            except:
                traceback.print_exc()
                return
        elif ext in ('.JPG','.JPEG','.PNG','.GIF'):
            resource_state = None
            s_path = os.path.join(t_path,filename) 
            with open(s_path,'wb') as fd:
                fd.write(content)
            s_thumbnail_path = os.path.join(t_path,name+'.t.jpg') 
            make_thumbnail(s_path,s_thumbnail_path)
        else:
            return
        # might be uploading or adding slide
        # if s_id is found, it is updating slide's content only
        # so no more do something 
        s_state = None
        for s in t_state['slides']:
            if s['id'] == s_id:
                s_state = s
                break        
        if s_state is not None: return

        # create an instance of SlideState
        slide_state = SlideState(t_state,s_id,resource_state=resource_state)
        s_state = slide_state.state
        #s_state['url'] = SlideState.get_url(p_state['id'],t_state['id'],s_id)
        if insert_at is None or insert_at == -1:
            t_state['slides'].append(s_state)
        else:
            t_state['slides'].insert(insert_at,s_state)

        if len(t_state['slides']) == 1:
            # set default slide_index to this slide because it might be None (due to without slides before adding)
            p_state['thread_settings'][t_state['id']]['slide_id'] = s_id
        
        if p_state['presentation_layout']['panels']['main'] is None:
            p_state['presentation_layout']['panels']['main'] = t_state['id']
            #self._refresh_thumbnail_of_presentation(p_state)
    
        self.update_presentation_state_cache(p_state['id'],p_state)

        return s_state
    '''



    '''
    no more presentation's thumbnail required

    def _refresh_thumbnail_of_presentation(self,p_state):
        # create thumbnail
        t_id = p_state['presentation_layout']['panels']['main']
        src_state = None
        if t_id:
            src_state = p_state['threads'][t_id]['slides'][0] if len(p_state['threads'][t_id]['slides']) else None
            if src_state:
                if src_state['resource']['type'] == 'IMG':
                    src_path = get_slide_thumbnail_path(p_state['owner'], p_state['id'],t_id,src_state['id'])
                else:
                    raise NotImplementedError()
                    #src_path = os.path.join(os.path.dirname(__file__),'resource','thumbnail_%s.jpg' % src_slide.resource.type.lower())
        
        if not src_state:
            src_path = os.path.join(os.path.dirname(__file__),'resource','thumbnail_default.jpg')
        
        dst_path = os.path.join(get_thread_path(p_state['owner'], p_state['id'],t_id),'thumbnail.jpg')
        #make_thumbnail(src_path,dst_path)
        shutil.copyfile(src_path, dst_path)
    '''

    def swap_slides(self,p_state,t_state,src_indexes,dst_index):
        dst_state = None if dst_index == -1 else t_state['slides'][dst_index]

        src_states = []
        for idx in src_indexes:
            src_states.append(t_state['slides'][idx])
        
        for slide in src_states:
            t_state['slides'].remove(slide) 
      
        if dst_index == -1:
            t_state['slides'].extend(src_states)
        else:
            dst_new_idx = t_state['slides'].index(dst_state)        
            t_state['slides'][dst_new_idx:dst_new_idx] = src_states

        self.on_presentation_changed(p_state)
        return True

class PresentationState(object):
    """
    這個PresentationState是用來產生p_state的，產生之後放入資料庫，未來主要的操作
    都是在資料庫讀回來的物件(dict)上，用完回存然後拋棄，盡量不在memory當中產生物件，以免增加overhead。
    """
    def __init__(self,root_folder,owner,name,p_state=None):
        self.root_folder = root_folder
        self.owner = owner #username who create this presentation
        
        if p_state:
            self.name = p_state['name']
            self.id = p_state['id'] 
            #ACL tokens, default to none, only dashboard accessed by owner is allowed
            self.acl_token = p_state['acl_token']
            self.settings = p_state['settings']
            #bus's room, should be altered periodically for security reason
            self.bus = p_state['bus']
            #self.presentation_layout = p_state['presentation_layout']
            self.thread_settings = p_state['thread_settings']
            self.threads = p_state['threads']
        else:
            self.name = name
            self.id = make_uuid()
            #as: audience screen, ss:speaker screen, ds:shared dashboard, ps: passcode(whiteboard)``
            self.acl_token = {'as': '', 'ss':'', 'ds':'', 'ps':''}
            self.settings = {
                'focus':'',#focus thread id
                'ratio':[4,3]
            }
            #bus's room, should be altered periodically for security reason
            self.bus = make_uuid(16)
            #self.presentation_layout = PresentationLayout(None).state
            # {t_id : {slide_id:value} }
            self.thread_settings = {}
            self.threads = {}

        self.path = get_presentation_path(owner,self.id)
        try:
            os.makedirs(self.path)
        except OSError as e:
            if e.errno != errno.EEXIST:
                raise

        # self.thread_settings  is a persistent settings for every thread
        # we keep the (thread_name, slide_name) pair, because maybe someday
        # a thread can be used in different presentation
        self._state = p_state

    @property
    def state(self):
        """
        for serialization and de-serialization

        _state = {
            'id':self.id, 字串；不會變
            'name':self.name, 字串；會變，還是字串
            'owner':self.owner, 字串；不會變
            'threads':self.threads, 字典；會變
            'thread_settings':self.thread_settings,字典；會變
            'settings':self.settings; 字典；會變
            'acl_token': self.acl_token, 字典；會變
            'bus':self.bus 字串；會變
        }

        """
        if self._state:
            return self._state
        
        self._state = {
            'id':self.id,
            'name':self.name,
            'owner':self.owner,
            'threads':self.threads,
            'thread_settings':self.thread_settings,
            'settings':self.settings,
            'acl_token': self.acl_token,
            'bus':self.bus,
        }
        return self._state        
'''
class PresentationLayout(object):
    def __init__(self,pl_state=None):
        # 4:3 or 16:9
        self.ratio = pl_state['ratio'] if pl_state else (4,3)
        
        # 'main' is must have panel
        if pl_state:
            self.panels = pl_state['panels']
        else:
            self.panels  = {
                    'main': None #thread-id
                }
        self._state = pl_state

    def set_thread(self,panel_name,thread):
        """
        set focus thread, will also generate thumbnail of this presentation.
        the thumbnail system is not best practice now.
        """
        # thread might be None or an instance of FSThread
        try:
            self.panels[panel_name] = thread.id if thread else None
            log.msg('set thread to %s' % (self.panels[panel_name].encode('utf-8') if thread else None) ,logLevel=logging.DEBUG)
            # create thumbnail
            dst_path = os.path.join(os.path.dirname(thread.path),'thumbnail.jpg')
            if thread and len(thread.slides):
                # thread.path's parent folder is presentation's folder
                src_slide = thread.slides[0]
                if src_slide.resource.type == 'IMG':
                    src_path = src_slide.path
                else:
                    src_path = os.path.join(os.path.dirname(__file__),'resource','thumbnail_%s.jpg' % src_slide.resource.type.lower())
            else:
                src_path = os.path.join(os.path.dirname(__file__),'resource','thumbnail_default.jpg')
            
            make_thumbnail(src_path,dst_path)

        except:
            traceback.print_exc()

    def get_thread(self,panel_name):
        return self.panels[panel_name]

    @property
    def state(self):
        """
        """
        if self._state: return self._state
        self._state = {
            'ratio':self.ratio,
            'panels':self.panels
        }
        return self._state
'''    
class Theme(object):
    def __init__(self,classname,t_state=None):
        self.classname = t_state['classname'] if t_state else classname
        self._state = t_state
    
    @property
    def state(self):
        if self._state: return self._state
        self._state = {
            'classname':self.classname
        }
        return self._state
    
    @property
    def public_state(self):
        return self._state

class ThreadState(object):
    """
    A t_state
    """
    def __init__(self,p_state,name,t_state=None):
        """
        id is generated by a incremental unique number in string.
        Starts from 001
        """       
        self.p_state = p_state
        if t_state:
            self.id = t_state['id']
        else:
            # Thread id naming is like columns of spread sheet.
            # It starts from 'A' to 'Z' (ascii 65-90)
            # at this moment, only 26 threads are allowed
            if 0: # debugging
                max_number_of_thread = 5
            else:
                max_number_of_thread = 26             
            
            if len(p_state['threads']):
                ids = p_state['threads'].keys()
                if len(ids) >= max_number_of_thread:
                    self.id = None
                    self._state = {
                        'id':None
                    }
                    return
                max_id = ord(max(ids))
                if max_id < (65 + max_number_of_thread):
                    self.id = chr(max_id+1)
                else:
                    #find the minimum missing char
                    for i in range(65,91):
                        if not (chr(i) in ids):
                            self.id = chr(i)
                            break
            else:
                self.id = 'A'
        
        # default name to the same as self.id
        self.name = t_state['name'] if t_state else (name if name else self.id)
        self.path = get_thread_path(p_state['owner'],p_state['id'],self.id)
        
        # create thread folder if we are not restore this thread
        # if we are restoring this thread but this path is not existed, then giveup restoring
        if t_state and not os.path.exists(self.path):
            raise RuntimeError('thread path not existed but expected to be "%s"' % self.path)
        elif os.path.exists(self.path) and not t_state:
            raise RuntimeError('thread path existed but expected not to be "%s"' % self.path)
        
        if not os.path.exists(self.path):
            os.mkdir(self.path)
        
        self.theme = t_state['theme'] if t_state else Theme('sbs-default',None).state
        if t_state:
            self._state = t_state
            self.slides = t_state['slides']
        else:
            self._state = None
            self.slides = []
    @property
    def state(self):
        if self._state: return self._state
        self._state = {
            'name':self.name,
            'id':self.id,
            'theme':self.theme,
            'slides':self.slides,
        }
        return self._state


class Overlay(object):
    """
    hold drawing data of a slide
    """
    def __init__(self,ol_state=None):
        self.layers = ol_state['layers'] if ol_state else [[]]
        #self.visible = ol_state['visible'] if ol_state else False
        self._state = ol_state
    
    @property
    def state(self):
        if self._state: return self._state
        self._state = {
            'layers':self.layers,
            #'visible':self.visible,
        }
        return self._state
    @property
    def public_state(self):
        return self._state

    def add_data(self,layer_index,data):
        self.layers[layer_index].append(data)


resource_factory = {}
def register_resource(cls):
    resource_factory[cls.type] = cls

# modified by whiteboard system to implment blank-slide
# and convert to other resource type
# 2018/11/7 Slide應該只是一個container，內容由resource決定
class SlideState(object):
    def __init__(self,t_state,s_id,s_state=None):
        """
        Arguments:
            s_id: filename (currently implemented) 
            s_state: a dict to restore 
            resource_state: a dictionary(object) from js to be resource's state (aka metadata)
        """
        self.t_state = t_state
        # id is unique for a thread, if slide has file, id is its filename
        self.id = s_state['id'] if s_state else s_id

        # this file is the raw data of this slide
        # we keep the name (instead of index) in path,
        # for that we can replace its content later
        #self.path = s_state['path']

        # create an instance of "Resource", this is kind of metadata manager
        # to the raw data
        if s_state:
            # s_state is given only when restoring
            #assert resource_state is None
            self.resource = s_state['resource']
            self.overlay = s_state['overlay']
            self.zoom = s_state['zoom']
            self.translate = s_state['translate']
            self.extra = s_state.get('extra')# optional
            self.widgets = s_state.get('widgets',[])
        else:            
            # create a new blank state
            #assert resource_state is None
            resource = BlankResource(self)

            self.resource = resource.state            
            self.overlay = Overlay().state
            self.zoom = [1,0,0]
            self.translate = [0,0]
            # extra data for more detail
            # (this is obsoleted)
            self.extra = None

            self.widgets = []

        self._state = s_state
    @property
    def state(self):
        if self._state: return self._state        
        self._state = {
            'id':self.id,
            'resource':self.resource,
            'overlay':self.overlay,
            'zoom':self.zoom,
            'translate':self.translate
            ,'widgets':self.widgets
        }
        if self.extra is not None:
            self._state['extra'] = self.extra
        return self._state 
    
    def set_resource(self,p_state,t_state,filename, content):
        # when this is called, content is not in file system , it is in memory
        _,ext = os.path.splitext(filename)
        assert ext ,'unusual resource filename:%s' % filename
        username = p_state['owner']
        t_path = get_thread_path(username,p_state['id'],t_state['id'])
        
        if  ext.upper() in ('.JPG','.JPEG','.PNG','.GIF'):
            existing_filename = self.resource['bg']
            if existing_filename:
                try:
                    os.unlink(os.path.join(t_path,existing_filename))
                except OSError:
                    # not existed
                    pass

            # so we have to save contents to a savable name in file system
            factory = resource_factory.get('BLANK')
            resource_obj = factory(self,None)
            # prefix self.id, to avoid different slide of same name
            # which goes wrong if one of it been deleted
            bg_filename = self.id+'.'+slugify(filename)
            resource_obj.bg = bg_filename
            self.resource.update(resource_obj.state)
            # dealing with uploaded image and make thumbnail
            bg_image_path = os.path.join(t_path,bg_filename)
            thumbnail_path = os.path.join(t_path,self.id+'.t.jpg')
            if ext.upper() == '.GIF':
                with open(bg_image_path,'wb') as fd:
                    fd.write(content)
                make_thumbnail(bg_image_path,thumbnail_path)
            else:
                s_fd = BytesIO()
                s_fd.write(content)
                d = defer.Deferred()
                def normalize(d, s_fd, bg_image_path,thumbnail_path):
                    # would also make thumbnail
                    try:
                        max_size = 2048.0
                        normalize_image(s_fd,bg_image_path,thumbnail_path,max_size)
                    except:
                        log.debug(traceback.format_exc())
                    finally:
                        s_fd.close()
                        d.callback(self.resource)
                reactor.callInThread(normalize,d,s_fd,bg_image_path,thumbnail_path)            
                return d
        elif ext.upper() == '.JSON':
            try:
                resource_state = json.loads(content)
            except ValueError:
                log.debug('json error:%s...' % content[:40])
            else:
                factory = resource_factory.get(resource_state.get('type'))
                if factory:
                    """
                    if resource_type == 'VIDEO':
                        resource = Video(self,None,init_state=resource_state)
                    elif resource_type == 'URL':
                        resource = WebLink(self,None,init_state=resource_state)
                    elif resource_type == 'OP':
                        resource = OnlinePresentation(self,None,init_state=resource_state)
                    """
                    resource_obj = factory(self,None,init_state=resource_state)
                    self.resource.update(resource_obj.state)
                else:
                    log.debug('unknow resource of resource_state.type=%s' % resource_state.get('type'))
        else:
            pass
        return self.resource

    def add_file(self,p_state,t_state,uuid,filename, content):
        # Caution: when this is called, content is not in file system , it is in memory
        #
        # 將widget的unit上傳的檔案加入本thread的目錄中。
        # 假設一個unit只有一個檔案; uuid是為了清除該unit舊有的檔案
        #
        _,ext = os.path.splitext(filename)
        assert ext ,'unusual resource filename:%s' % filename
        username = p_state['owner']
        t_path = get_thread_path(username,p_state['id'],t_state['id'])
        # 先清掉相同uuid的檔案，此檔案必定以uuid開頭
        files = glob.glob(os.path.join(t_path,uuid+'.*'))
        for file in files:
            os.unlink(file)
        if  ext.upper() in ('.JPG','.JPEG','.PNG','.GIF'):
            slugified_filename = uuid+'.'+slugify(filename)
            # dealing with uploaded image and make thumbnail
            s_path = os.path.join(t_path,slugified_filename)
            if ext.upper() == '.GIF':
                with open(s_path,'wb') as fd:
                    fd.write(content)
            else:
                s_fd = BytesIO()
                s_fd.write(content)
                d = defer.Deferred()
                def normalize(d, s_fd, s_path,slugified_filename):
                    # would also make thumbnail
                    try:
                        max_size = 2048.0
                        # Not to make thumbnail
                        normalize_image(s_fd,s_path,None,max_size)
                    except:
                        log.debug(traceback.format_exc())
                    finally:
                        s_fd.close()
                        d.callback(slugified_filename)
                reactor.callInThread(normalize,d,s_fd,s_path,slugified_filename) 
                return d
        return None
    def clone_file(self,p_state,t_state,uuid,filename):
        username = p_state['owner']
        t_path = get_thread_path(username,p_state['id'],t_state['id'])
        src_path = os.path.join(t_path,filename)
        #remove leading chunk, which is uuid of source unit
        chunks = filename.split('.')
        chunks.pop(0)
        cloned_filename = uuid+'.'+ '.'.join(chunks)
        try:
            dst_path = os.path.join(t_path,cloned_filename)
            print("cloning file",src_path,'to', dst_path)
            shutil.copyfile(src_path, dst_path)
            return cloned_filename
        except OSError:
            return None
class ResourceItem(object):
    # ISourceItem

    # type是client render此slide的依據
    # should be overrided 
    type = None 
    
    def __init__(self,slide,re_state=None,init_state=None):
        """
        re_state 用於回復resource物件的資料
        init_state 用於新創resource物件的資料
        """
        self.slide = slide
        if re_state:
            self.color = re_state['color']
            self.bg = re_state['bg']
        else:
            self.color = 'FFFFFF' # this is background color
            self.bg = '' # this is background image's url (local path, not other site's URL)
        
        self._state = re_state
        if re_state:
            self.restore_from_state()
    
    @property
    def state(self):
        if self._state: return self._state    
        self._state = {
            'type':self.type,
            # 這是slide的背景顏色
            'color':self.color,
            # 當type＝BLANK時為此slide的底圖檔名
            'bg':self.bg
        }
        return self._state
    
    def restore_from_state(self):
        # override this if necessary
        pass

class BlankResource(ResourceItem):
    #用於whiteboard系統的一般性slide
    type = 'BLANK'
register_resource(BlankResource)

class Text(ResourceItem):
    type = 'TEXT'
    def __init__(self,slide,re_state=None,init_state=None):
        super(Text,self).__init__(slide,re_state,init_state)
        self.content = init_state['content'] if init_state else ''
        # 0:no wrap, if self.wrap > 0, 
        # it is the "line-length" length (in js) to break a line
        self.wrap = 0
        self.scroll = [0,0] #[left,top]
        self.hilight = []
    
    @ResourceItem.state.getter
    def state(self):
        #in PY2, should call super(Text,self).state
        super().state
        self._state['content'] = self.content
        self._state['wrap'] = self.wrap
        self._state['scroll'] = self.scroll
        self._state['hilight'] = self.hilight

        return self._state
    
register_resource(Text)

class Video(ResourceItem):
    """
    Has to ensure url is supported video source.
    dashboard.js has checked once in window.slide_resource_factory.
    Expected video follows:

    1. https://www.youtube.com/watch?v=MKWWhf8RAV8
    2. https://youtu.be/U0cJLHF3g8g?t=24s
    3. <iframe width="560" height="315" src="https://www.youtube.com/embed/DJsGqx0LykY?rel=0&amp;controls=0&amp;showinfo=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
    4. <iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/DJsGqx0LykY?start=600" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>

    Testing movie clips:
    1. https://www.youtube.com/watch?v=4993sBLAzGA (live stream)
    2. https://youtu.be/B1ntjW1uEzY?t=54m51s  (regular movie)
    3. https://www.youtube.com/watch?v=MKWWhf8RAV8 (3d)
    """
    type = 'VIDEO'
    def __init__(self,slide,re_state=None,init_state=None):        
        super(Video,self).__init__(slide,re_state,init_state)
        if init_state is not None:
            # expect browser sends a dict like this:
            # {
            #   type:'VIDEO', 
            #   data:{
            #           kind:'yt'
            #           metadata:{
            #               vid: video id
            #               pt: player time,
            #               state:
            #           }
            #       }
            # }
            assert isinstance(init_state,dict)
            assert init_state['type'] == 'VIDEO' #enforce to be VIDEO
            self._state = init_state
register_resource(Video)

class WebLink(ResourceItem):
    type = 'URL'
    def __init__(self,slide,re_state=None,init_state=None):        
        super(WebLink,self).__init__(slide,re_state,init_state)
        if init_state is not None:
            # expect browser sends a dict like this:
            # {
            #   type:'URL', 
            #   data:{
            #           url:'http...'
            #       }
            # }
            assert isinstance(init_state,dict)
            assert init_state['type'] == 'URL' #enforce to be URL
            self._state = init_state
register_resource(WebLink)

class OnlinePresentation(ResourceItem):
    type = 'OP'
    def __init__(self,slide,re_state=None,init_state=None):        
        super(OnlinePresentation,self).__init__(slide,re_state,init_state)
        if init_state is not None:
            # expect browser sends a dict like this:
            # {
            #   type:'OP', 
            #   data:{
            #           kind:'gp',//google presentation
            #           url:'...'
            #       }
            # }
            assert isinstance(init_state,dict)
            assert init_state['type'] == 'OP' #enforce to be OP
            self._state = init_state
register_resource(OnlinePresentation)

if __name__ == '__main__':
    pass