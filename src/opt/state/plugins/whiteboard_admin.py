#! -*- coding:utf-8 -*-
from .__init__ import *
# above is the magic line to be auto imported by objstate.py
from twisted.internet import reactor, defer
import os, sys, time, json, stat, uuid, copy
import traceback
import random
import datetime
import hashlib
import shutil
#from twisted.web.client import Agent
#from twisted.internet.protocol import Protocol
#from twisted.web.iweb import UNKNOWN_LENGTH
from twisted.python import log
#import twisted.internet._sslverify as v
#v.platformTrust = lambda : None
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
#user.username == __main__.config.sidebyside_acl['admin']:
class WhiteboardAdmin(SimpleStateValue):
    def __init__(self):
        super(WhiteboardAdmin,self).__init__()
        self.expired_interval = 7 * 24 * 60 * 60 # 7 days

    def is_ready(self):
        d = defer.Deferred()
        def init():
            # call later to wait server_dispatcher be available
            self.presentation_root_folder = statetree.root.sidebyside.presentation_root_folder
            self.server_dispatcher = self.presentation_root_folder.server_dispatcher
            d.callback(True)
        # 晚1秒，等statetree.root.sidebyside 已經產生後再呼叫
        reactor.callLater(1,init)
        return d
    
    def acl(self,task):
        if not task.user.username == __main__.config.sidebyside_acl['admin']:
            raise StateError(message='Forbidden',retcode=403)
    
    @resource(public=False)
    def whoami(self,request):
        user = request.user
        if user and user.authenticated:
            return user.username.encode()
        else:
            return b'guest'

    def state(self):
        return b'This is WhiteboardAdmin'

    @resource(public=False)
    def hello(self,request):
        return b'Hi, how are you?'

    @exportable
    def get_available_hosts(self,task):
        self.acl(task)
        records = {}
        for host_id, data in self.server_dispatcher.available_host_dict.items():
            records[data['access_path']] = (host_id,data)
        for access_path,data in self.server_dispatcher.active_count_dict.items():
            try:
                records[access_path][1]['count'] = data['count']
            except KeyError:
                log.warn('access_path ignored',access_path)
        return list(records.values())
    get_available_hosts.require_task = True

    @exportable
    def get_active_hosts(self,task):
        self.acl(task)
        records = {}
        for access_path,data in self.server_dispatcher.active_count_dict.items():
            records[access_path] = data
        return records
    get_active_hosts.require_task = True

    @exportable
    def remove_available_host(self,task,host_id,access_path):
        self.acl(task)
        try:
            del self.server_dispatcher.available_host_dict[host_id]
        except KeyError:
            log.warn('host id "%s" not found in available_host_dict' % host_id)
        try:
            del self.server_dispatcher.active_count_dict[access_path]
        except KeyError:
            log.warn('access_path "%s" not found in active_count_dict' % access_path)
        return True
    remove_available_host.require_task = True

    @exportable
    def remove_active_host(self,task,access_path):
        self.acl(task)
        try:
            del self.server_dispatcher.active_count_dict[access_path]
        except KeyError:
            log.warn('access_path "%s" not found in active_count_dict' % access_path)
        return True
    remove_active_host.require_task = True

    @exportable
    def get_delegate_host_table(self,task):
        self.acl(task)
        items = list(self.server_dispatcher.delegate_host_dict.items())
        return items
    get_delegate_host_table.require_task = True

    @exportable
    def cleanup_local_fs(self,task, dryrun):
        """
        清除本機上多餘的presentation 目錄
        多餘的定義：
        一、逐一檢視本機上的簡報目錄（靜態檔案），是否存在於簡報資料庫中，如果不存在則刪除該目錄。
        二、若簡報目錄所在的username不存在於資料庫
           或者folder (p_id) 與資料庫該user所擁有之簡報的ID。
           或者該p_id不存在於簡報資料庫當中。
           則該簡報目錄也會被刪除。
        三、資料庫的維護：
            （一）若有一使用者檔案目錄，該目錄名稱（亦即username)不存在於資料庫中，則
            其下之簡報目錄(p_id)若在簡報資料庫當中，則簡報（p_id)的紀錄也會被刪除。
            
        """
        self.acl(task)

        statistics = {
            'local file system':{
                'extra_folders':('本機上將被刪除多餘目錄',0),
                'p_folders_count':'本機簡報目錄數量',
                'u_folders_count':'本機使用者目錄數量'
            }
        }
        count = {}
        for group, member in statistics.items():
            for key in member.keys():
                count[key] = 0
        
        filestore_agent = self.presentation_root_folder.filestore_agent
        extra_folders = [] 
        now = timestamp()
        # 下取兩層目錄（使用者／簡報)的清單
        user_presentations_folders = filestore_agent.client.get_local_user_presentations_folders()
        count['u_folders_count'] += len(user_presentations_folders)
        for username, folders in user_presentations_folders.items():
            try:
                p_ids_of_user = self.presentation_root_folder.db.user_presentation_dict[username]
            except KeyError:
                # 無此使用者（可能是開發過程留下的帳號）
                extra_folders.append(username)
                print('non-existed user folder',username)
                continue
            # 在此user目錄下，應從File system刪除的目錄
            count['p_folders_count'] += len(folders)
            user_extra_folders = []
            for folder in folders:
                p_id = folder
                try:
                    p_state = self.presentation_root_folder.db.presentation_states_dict[p_id]
                except KeyError:
                    # 這個目錄所對應的 p_id不在資料庫 presentation_states_dict 當中
                    print('remove of not found',p_id)
                    user_extra_folders.append(os.path.join(username,folder))
                else:
                    if not (p_id in p_ids_of_user):
                        # 這個目錄所對應的 p_id不屬於此帳號
                        user_extra_folders.append(os.path.join(username,folder))
            # 如果全部子目錄都被刪除了，直接刪除該使用者目錄（目前該使用者目錄下應只有簡報目錄）
            if len(user_extra_folders) == len(folders):
                extra_folders.append(username)
            else:
                extra_folders.extend(user_extra_folders)
        
        # 刪除本機上多餘的目錄
        count['extra_folders'] += len(extra_folders)
        if not dryrun:
            filestore_agent.client.pause()
            for relpath in extra_folders:
                path = os.path.join(filestore_agent.client.local_folder,relpath)
                #print('remove path',path)
                shutil.rmtree(path,ignore_errors=True)
        
            # 這裡有個風險是，此1秒內被產生的presentation目錄會沒有被複製到file store主機
            def resume():
                filestore_agent.client.resume()
            reactor.callLater(1,resume)

        # generate output format for w2ui-grid
        ret = {}
        for group, member in statistics.items():
            ret[group] = {}
            for key,value in member.items():
                if isinstance(value,str):
                    desc = value
                    attention = False
                else:
                    desc = value[0]
                    # the 2nd value is an expectation value of count[key]
                    # currently it is zero.
                    attention = False if count[key] == value[1] else True
                ret[group][key] = {
                    'value':count[key],
                    'desc':desc,
                    'attention':attention
                }
        ret['options'] = {
            'dryrun':{
                'value':dryrun,
                'desc': ''
            }
        }
        return ret
    cleanup_local_fs.require_task = True
    '''
    @exportable
    def cleanup_database(self,task):
        self.acl(task)

        db = self.presentation_root_folder.db

        # the cache of removed items
        removed = {
            'username':{},
            'p_id':{}
        }

        def remove_username(username):
            # remove from user_presentation_dict
            p_ids_to_remove = []
            try:
                p_ids = db.user_presentation_dict[username]
            except KeyError:
                pass
            else:
                p_ids_to_remove.extend(p_ids)
            # remove from sbs_name_dict
            try:
                del db.sbs_name_dict[username]
            except KeyError:
                pass
            
            # remove from binding_dict
            try:
                binding = db.binding_dict[username]
            except KeyError:
                pass
            else:
                if isinstance(binding,str):
                    # username is binding to another username
                    try:
                        all_bindings = db.binding_dict[binding]
                    except KeyError:
                        pass
                    else:
                        if username in all_bindings:
                            all_bindings.remove(username)
                            if len(all_bindings) == 0:
                                # remove this item
                                del db.binding_dict[binding]
                            else:
                                # update this item
                                 db.binding_dict[binding] = all_bindings
                else:
                    #username is been binded by other usernames
                    del db.binding_dict[binding]
                    for binder in binding:
                        try:
                            binded = db.binding_dict[binder]
                        except KeyError:
                            log.warn('binding db inconsistent type #1')
                        else:
                            if binded == username:
                                del db.binding_dict[binder]
                            else:
                                log.warn('binding db inconsistent type #2')
            removed['username'][username] = 1
            return p_ids_to_remove
        
        def remove_p_id(p_id):
            username_to_remove = None
            
            try:
                db.delegate_host_dict[p_id]
            except KeyError:
                pass
            
            try:
                p_state = db.presentation_states_dict[p_id]
            except KeyError:
                pass
            else:
                acl_token = p_state['acl_token']
                for token in acl_token.values():
                    #if (token is None) or (token == ''): continue
                    if not token: continue
                    log.debug('removing token %s' % token)
                    try:
                        # 此數值 db.token_presentation_dict[token] 應該是p_id
                        # 此處暫時不做一致性檢查
                        del db.token_presentation_dict[token]
                    except KeyError:
                        # 應該存在才合理
                        log.warn('token_presentation_dict db inconsistent type #1')
                username = p_state['owner']
                p_ids = db.user_presentation_dict[username]
                if p_id in p_ids:
                    p_ids.remove(p_id)
                    if len(p_ids) == 0:
                        username_to_remove = username
                    else:
                        db.user_presentation_dict[username] = p_ids
                else:
                    log.warn('user_presentation_dict db inconsistent type #2')                
                
                del db.presentation_states_dict[p_id]
            removed['p_id'][p_id] = 1
            return username_to_remove
        
        # 開始執行JOB 6
        now = timestamp()
        expired_ts = now - self.expired_interval
        expired_p_ids = []
        for p_id in db.presentation_states_dict.keys():
            try:
                atime = db.presentation_atime_dict[p_id]
            except KeyError:
                expired_p_ids.append(p_id)
            else:
                if atime < expired_ts:
                    expired_p_ids.append(p_id)

        # 開始移除p_id
        log.info('number of %s expired p_id is going to be removed ' % len(expired_p_ids))
        usernames_to_remove = []
        for p_id in expired_p_ids:
            try:
                removed['p_id'][p_id]
            except KeyError:
                log.debug('removing p_id '+p_id)
                username_to_remove = remove_p_id(p_id)
                if username_to_remove is not None:
                    usernames_to_remove.append(username_to_remove)
            try:
                del db.presentation_atime_dict[p_id]
            except KeyError:
                pass
        # 開始移除使用者
        p_ids_to_remove_again = []
        log.info('number of %s expired username is going to be removed ' % len(usernames_to_remove))
        for username in usernames_to_remove:
            try:
                removed['username'][username]
            except KeyError:
                p_ids_to_remove = remove_username(username)
                p_ids_to_remove_again.extend(p_ids_to_remove)
         
        # 開始再次移除p_id
        log.info('number of %s p_id is going to be removed again' % len(p_ids_to_remove_again))
        usernames_to_remove_again = []
        for p_id in p_ids_to_remove_again:
            try:
                removed['p_id'][p_id]
            except KeyError:
                log.debug('removing again p_id '+p_id)
                username_to_remove = remove_p_id(p_id)
                if username_to_remove is not None:
                    usernames_to_remove_again.append(username_to_remove)
        log.info('number of %s username remained ' % len(usernames_to_remove_again))

        # 開始執行Job7
        available_hosts = []
        for access_path, hostdata in db.available_host_dict.items():
            if hostdata['online']:
                available_hosts.append(access_path)
        
        p_ids_to_remove = []
        for p_id, host_access_path in db.delegate_host_dict.items():
            try:
                p_state = db.presentation_states_dict[p_id]
            except KeyError:
                p_ids_to_remove.append(p_id)
            else:
                if not host_access_path in available_hosts:
                    # this will enfore this p_id to be reassigned
                    p_ids_to_remove.append(p_id)
        db.delegate_host_dict.mdelete(p_ids_to_remove)
    cleanup_database.require_task = True
    '''
    def remove_username(self,username):
        db = self.presentation_root_folder.db
        
        p_ids_to_remove = []
        try:
            p_ids = db.user_presentation_dict[username]
        except KeyError:
            pass
        else:
            p_ids_to_remove.extend(p_ids)
        # remove from sbs_name_dict
        try:
            del db.sbs_name_dict[username]
        except KeyError:
            pass
        
        # remove from binding_dict
        try:
            binding = db.binding_dict[username]
        except KeyError:
            pass
        else:
            if isinstance(binding,str):
                # username is binding to another username
                try:
                    all_bindings = db.binding_dict[binding]
                except KeyError:
                    pass
                else:
                    if username in all_bindings:
                        all_bindings.remove(username)
                        if len(all_bindings) == 0:
                            # remove this item
                            del db.binding_dict[binding]
                        else:
                            # update this item
                            db.binding_dict[binding] = all_bindings
            else:
                #username is been binded by other usernames
                del db.binding_dict[binding]
                for binder in binding:
                    try:
                        binded = db.binding_dict[binder]
                    except KeyError:
                        log.warn('binding db inconsistent type #1')
                    else:
                        if binded == username:
                            del db.binding_dict[binder]
                        else:
                            log.warn('binding db inconsistent type #2')
        return p_ids_to_remove


    def remove_p_id(self,p_id):
        db = self.presentation_root_folder.db

        try:
            del db.presentation_atime_dict[p_id]
        except KeyError:
            pass
        
        try:
            p_state = db.presentation_states_dict[p_id]
        except KeyError:
            pass
        else:
            acl_token = p_state['acl_token']
            for token in acl_token.values():
                #if (token is None) or (token == ''): continue
                if not token: continue
                log.debug('removing token %s' % token)
                try:
                    # 此數值 db.token_presentation_dict[token] 應該是p_id
                    # 此處暫時不做一致性檢查
                    del db.token_presentation_dict[token]
                except KeyError:
                    # 應該存在才合理
                    log.warn('token_presentation_dict db inconsistent type #1')

                try:
                    db.delegate_host_dict[token]
                except KeyError:
                    pass

            username = p_state['owner']
            try:
                p_ids = db.user_presentation_dict[username]
            except KeyError:
                pass
            else:
                if p_id in p_ids:
                    p_ids.remove(p_id)
                    # 雖然 p_ids 可能是空的，但還是留著此紀錄，以保留 username之間的binding關係
                    db.user_presentation_dict[username] = p_ids
                else:
                    log.warn('user_presentation_dict db inconsistent type #2')                
            
            del db.presentation_states_dict[p_id]

    @exportable
    def health_check_database(self,task,dryrun):
        """
        dryrun:(boolean), if true, donot modify database

        維持資料庫品質
            'user_presentation_dict',
            'presentation_states_dict',
            'token_presentation_dict',
            'presentation_atime_dict',
            'binding_dict',
            'sbs_name_dict',
            'delegate_host_dict', 

            'available_host_dict',
            'active_count_dict',
            
            'quickshortcut_codes_dict', 
            'quickshortcut_pids_dict',
            'handover_data_dict',        

        Job 1:
        ＊ user_presentation_dict (username => [p_id])
            所有的p_id應該都在presentation_states_dict有紀錄
                如果沒有的話，理論上，不應該有這樣的情況，如果遇到處理方式為：
                p_id要刪除，同時，更新 user_presentation_dict.
                因為在whiteboard系統，一個username會對應一個presentation，
                所以user_presentation_dict當中該username的value會變成空的，
                如此，則直接把該username的紀錄從 user_presentation_dict 刪除.
                user會在下次進入自己的whiteboard(by app/whiteboard.html)時，
                由系統替他創建一個新的whiteboard

        Job 2:
        * presentation_states_dict (p_id => p_state)
            所有的p_state的acl_token都應該在 token_presentation_dict 有紀錄.
            如果沒有，理論上不應該有這樣的情況，但如果真的遇到了，
            則在token_presentation_dict增加紀錄。
        
        Job 3:
        * token_presentation_dict (token => p_id)
            這是由token反查p_id的資料表。

        Job 4:
        * binding_dict
            case 1: 如果是binder時， username_a => username_b
            如果username_a不存在於 user_presentation_dict，則此紀錄應刪除
            如果username_b不存在於 user_presentation_dict，則此紀錄應刪除
                此時，也應檢查username_b是否有 case 2 的情況，若有，則該紀錄應刪除

            case 2:  如果是被bind時， username_b => [username_a1,username_a2,...]
                如果username_b不存在於 user_presentation_dict，則此紀錄應刪除
                如果是username_a不存在於 user_presentation_dict 則此記錄應更新
                    如果最後為空集合，則此記錄應刪除
        
        Job 5:
        * sbs_name_dict (username => sbs_name)
            如果username不存在於 user_presentation_dict，則此紀錄應刪除

        Job 6:
        * presentation_atime_dict (p_id => last access time)
            這是由 p_id查詢最後一次存取紀錄的資料表。目前沒有一個username何時創建的資料。
            如果此數值高於threshold(ex 1 week)則此 presentation 將被刪除，包括：
            presentation_states_dict
            token_presentation_dict
            以及因從presentation_states_dict移除而導致的此username從 user_presentation_dict 移除
            而其在各主機之靜態檔案目錄，也將因此而在執行 self.cleanup_local_folders()時被移除。
        Job 7:
        * delegate_host_dict (p_id => host_access_path)
            所有的p_id都必須在presentation_states_dict當中，反之亦然。
            所有的 host_access_path都必須在 available_host_dict當中，且online
        
        維護的順序如下：
        JOB 6, 這樣會移除 presentation_states_dict 中的p_id 跟
                被移除的p_state在 token_presentation_dict中的紀錄。
                並將移除的 p_id與pstate[owner](aka username) 被放在cache中
        
        JOB 1,  這樣會移除 user_presentation_dict 當中已經失去p_id（aka p_id 失效）的username
                （包括因 job 6而來的刪除）
                只要username被移除，就同時從 binding_dict, sbs_name_dict 移除 （執行job 4, job5）
                binding_dict 移除username時只搜尋key的部分(binding to or been binded)並同時更新其餘的目錄
        
        JOB 2,  這樣會補充 token_presentation_dict 的紀錄，並建立一個所有token的cache

        JOB 3,  這樣會移除在   token_presentation_dict 當中多餘的紀錄（藉由 JOB2 建立的cache)

        JOB 4, 5,  這樣會移除 binding_dict, sbs_name_dict 當中多餘的紀錄（username 不存在了）        
        """
        self.acl(task)
        db = self.presentation_root_folder.db
        statistics = {
            # username
            'username':{
                'username_count':'有效帳號總數',
                'p_ids_of_username_count':'使用者擁有簡報',
                'username_of_0_p_ids':'沒有簡報的使用者',
                'username_of_2_p_ids':'一個以上簡報的使用者',
                'username_has_no_sbsname':('沒有名稱的使用者（正常應為0）',0),
                'extra_sbsname':('多餘的使用者稱呼sbsname(username不存在；正常為0)',0),
                'sbsname_count':'使用者稱呼sbsname總數',
                'username_been_removed':'本次移除的使用者',
            },
            # binding
            'binding':{
                'binder_count':'綁定的使用者數量',
                'binded_count':'被綁定的使用者數量',
                'binding_value_wrong_type':('綁定數值類型錯誤（正常應為0）',0),
                'binder_of_invalid_target':('被綁定的使用者不存在（正常應為0)',0),
                'invalid_username_in_binding_dict':('綁定中有使用者無效（正常應為0）',0),
                'binding_of_invalid_binder':('綁定使用者不存在（正常應為0）',0),
                'binding_dict_been_removed':'本次刪除的綁定紀錄',
                'bindind_dict_been_reset':'本次重設的綁定紀錄',
            },
            # p_id and p_state
            'presentation':{
                'p_id_count':'有效簡報數量',
                'missing_in_atime':'最近一次使用紀錄中的簡報不存在',
                'expired_by_atime':'已經很久沒有使用的簡報',
                'wrong_p_id_of_token':('token對應到的簡報錯誤（正常應為0）',0),
                'missing_p_id_of_token':('缺乏token的對應紀錄（正常應為0）',0),
                'p_id_of_invalid_owner':('簡報的擁有者不存在（正常應為0）',0),
                'p_id_been_removed':'本次移除的簡報',
                'token_been_reset':'本次重設token的簡報數量',
                'token_been_reset_count':'本次重設的token數量',
                'p_id_atime_count':'簡報之最近存取時戳記錄總數',
                'atime_of_invalid_p_id':('簡報之最近存取時戳記錄無效的簡報p_id',0)
            },
            # delegate host
            'host delegation':{
                'delegate_host_count':'配發總數（正常應與「有效簡報總數」相同）',
                'invalid_token_in_delegate_host':('在配發主機表中的無效簡報（正常應為0）',0),
                'token_of_offline_access_path':('簡報所配發的主機不存在或已經下線（正常應為0）',0),
                'token_of_delegate_host_dict_been_removed':'本次移除的配發紀錄項目數量',
            }
        }
        count = {}
        for group, member in statistics.items():
            for key in member.keys():
                count[key] = 0
        # username 帳號的健康 
        username_of_no_p_id = []
        for username,p_ids in db.user_presentation_dict.items():
            count['username_count'] += 1
            count['p_ids_of_username_count'] += len(p_ids)
            if len(p_ids) == 0:
                count['username_of_0_p_ids'] += 1
                username_of_no_p_id.append(username)
            elif len(p_ids) > 1:
                count['username_of_2_p_ids'] += 1
            try:
                sbs_name = db.sbs_name_dict[username]
            except KeyError:
                count['username_has_no_sbsname'] += 1
        
        # 在 user_presentation_dict； 刪除沒有presentation且沒有binding的紀錄
        username_to_remove = []
        for username in username_of_no_p_id:
            try:
                db.binding_dict[username]
            except KeyError:
                username_to_remove.append(username)
        
        count['username_been_removed'] += len(username_to_remove)
        if not dryrun:
            db.user_presentation_dict.mdelete(username_to_remove)
        
        extra_sbsname = []
        for username in db.sbs_name_dict.keys():
            count['sbsname_count'] += 1
            try:
                db.user_presentation_dict[username]
            except KeyError:
                extra_sbsname.append(username)
        count['extra_sbsname'] += len(extra_sbsname)
        if not dryrun:
            db.sbs_name_dict.mdelete(extra_sbsname)
        # binding系統的健康
        binding_item_to_remove = {}
        binding_item_to_reset = {}
        for username,target in db.binding_dict.items():
            try:
                p_ids = db.user_presentation_dict[username]
            except KeyError:
                count['invalid_username_in_binding_dict'] += 1
                binding_item_to_remove[username] = 1
                continue # this entry should be removed
            
            if isinstance(target, str):
                count['binder_count'] += 1
                try:
                    p_ids = db.user_presentation_dict[target]
                except KeyError:
                    count['binder_of_invalid_target'] += 1
                    binding_item_to_remove[username] = 1
            
            elif isinstance(target, list):
                count['binded_count'] += 1
                valid_binder = []
                for binder in target:
                    try:
                        p_ids = db.user_presentation_dict[binder]
                    except KeyError:
                        count['binding_of_invalid_binder'] += 1
                    else:
                        valid_binder.append(binder)
                if len(target) == 0:
                    binding_item_to_remove[username] = 1
                elif len(valid_binder) == 0:
                    binding_item_to_remove[username] = 1
                elif len(target) > len(valid_binder):
                    binding_item_to_reset[username] = valid_binder
            else:
                count['binding_value_wrong_type'] += 1
                binding_item_to_remove[username] = 1
        
        # 在 binding_dict， 
        # 刪除 無效 binder 或 binding target （沒有在 user_presentation_dict)中
        count['binding_dict_been_removed'] += len(binding_item_to_remove)
        count['bindind_dict_been_reset'] += len(binding_item_to_reset)
        if not dryrun:
            db.binding_dict.mdelete(list(binding_item_to_remove.keys()))
            for username, valid_binder in binding_item_to_reset.items():
                db.binding_dict[username] = valid_binder
        
        # presentation系統的健康
        now = timestamp()
        expired_ts = now - self.expired_interval
        presentation_states_item_to_remove = {}
        item_to_add_token = {}
        # 只有這三種flag可能出現在 token_presnetation_dict當中
        flag_of_name = {
            'ss':'2',
            'as':'3',
            'ds':'4'
        }
        name_of_flag = {
            '2':'ss',
            '3':'as',
            '4':'ds'
        }
        for p_id,p_state in db.presentation_states_dict.items():
            count['p_id_count'] += 1
            try:
                atime = db.presentation_atime_dict[p_id]
            except KeyError:
                count['missing_in_atime'] += 1
            else:
                if atime < expired_ts:
                    count['expired_by_atime'] += 1
                    presentation_states_item_to_remove[p_id] = 1
                    continue # this entry should be removed

            owner = p_state['owner']
            try:
                p_ids = db.user_presentation_dict[owner]
            except KeyError:
                count['p_id_of_invalid_owner'] += 1
                presentation_states_item_to_remove[p_id] = 1
                continue # this entry should be removed

            acl_token = p_state['acl_token']
            for name, token in acl_token.items():
                # skip passcode and token not been assigned
                if (name == 'ps') or (not token): continue
                try:
                    p_id_flag = db.token_presentation_dict[token]
                except KeyError:
                    count['missing_p_id_of_token'] += 1
                    item_to_add_token[p_id] = 1
                else:
                    if ((p_id_flag[0] != p_id) or (name_of_flag[p_id_flag[1]] != name)): 
                        count['wrong_p_id_of_token'] += 1
                        item_to_add_token[p_id] = 1
        
        count['p_id_been_removed'] += len(presentation_states_item_to_remove)
        count['token_been_reset'] += len(item_to_add_token)
        if not dryrun:
            for p_id in presentation_states_item_to_remove.keys():
                self.remove_p_id(p_id)
            for p_id in item_to_add_token.keys():
                p_state = db.presentation_states_dict[p_id]
                for name, token in p_state['acl_token'].items():
                    if not token: continue
                    db.token_presentation_dict[token] = [p_id,flag_of_name[name]]
                    count['token_been_reset_count'] += 1

        # delegate_host 維護
        available_access_paths = []
        item_to_remove = []
        for host_id, hostdata in db.available_host_dict.items():
            if hostdata['online']:
                available_access_paths.append(hostdata['access_path'])
        
        for token,host_access_path in db.delegate_host_dict.items():
            count['delegate_host_count'] += 1
            try:
                p_id_flag = db.token_presentation_dict[token]
            except KeyError:
                count['invalid_token_in_delegate_host'] += 1
                item_to_remove.append(token)
            else:
                if not host_access_path in available_access_paths:
                    count['token_of_offline_access_path'] += 1
                    item_to_remove.append(token)
        
        atime_item_to_remove = []
        for p_id in db.presentation_atime_dict.keys():
            count['p_id_atime_count'] += 1
            try:
                db.presentation_states_dict[p_id]
            except KeyError:
                atime_item_to_remove.append(p_id)
        count['atime_of_invalid_p_id'] += len(atime_item_to_remove)
        if not dryrun:
            db.presentation_atime_dict.mdelete(atime_item_to_remove)

        count['token_of_delegate_host_dict_been_removed'] += len(item_to_remove)
        if not dryrun:
            db.delegate_host_dict.mdelete(item_to_remove)
        
        # generate output format for w2ui-grid
        ret = {}
        for group, member in statistics.items():
            ret[group] = {}
            for key,value in member.items():
                if isinstance(value,str):
                    desc = value
                    attention = False
                else:
                    desc = value[0]
                    # the 2nd value is an expectation value of count[key]
                    # currently it is zero.
                    attention = False if count[key] == value[1] else True
                ret[group][key] = {
                    'value':count[key],
                    'desc':desc,
                    'attention':attention
                }
        ret['username']['history_username_count'] = {'value':db.statistic_dict['username'],'desc':'累加使用者總數'}
        ret['presentation']['history_presentation_count'] = {'value':db.statistic_dict['presentation'],'desc':'累加簡報總數'}
        ret['options'] = {
            'dry-run':{'value':dryrun,desc:'',attention:True}
        }
        return ret
    health_check_database.require_task = True

    @exportable
    def purge_username(self,task):
        """
        把所有使用者資料都刪除，根據清理規則，也就是把所有的、全部的資料、檔案全部都清空
        """
        self.acl(task)
        usernames = list(self.presentation_root_folder.db.user_presentation_dict.keys())
        self.presentation_root_folder.db.user_presentation_dict.mdelete(usernames)
        return len(usernames)
    purge_username.require_task = True

    @resource(public=True)
    def test(self,request):
        # accessed by http://localhost:2880/@/admin/test
        if 0:
            data = {
                'topic':'test',
                'data':{'hello':'world'}
            }
            statetree.root.pub.bus.broadcast_by_internal_node('__ALL__',data)
        elif 1:
            self.take_host_down(self.presentation_root_folder.host)
        return b'OK'
    
    @exportable
    def take_host_down(self,host_to_shutdown,hosts_not_to_takeover=None,hosts_to_takeover=None):
        """
        Args:
            host_to_shutdown: (string) name of this host in config.py['cluster']['name']
            hosts_not_to_takeover:(list of string) 原則上本機服務中的簡報會轉移到其他所有上線中的主機，
                    但如果其他也有主機預備關機，則要排除那些主機接手；用黑名單的方式列舉之。
            hosts_to_takeover:(list of string)同上，也可以用白名單的方式，指定要分配到哪些主機。
        1. 不再接新的連線
            1.1 不分配新的websocket連線
            1.2 不分配新的static 連線(nginx)
        2. 轉移現有連線
            2.1 鎖定白板；不接受更新
            2.2 分配到其他主機並作檔案轉移
            2.3 連線到其他主機並解除白板鎖定
        """
        # 讓本host離線；關閉該host之前的善後工作；一定要連入本機執行
        if host_to_shutdown != self.presentation_root_folder.host:
            raise StateError(message='worng host to request offline',retcode=400)
        
        #通知client進入readonly
        data = {
            'topic':'misc-sync',
            'data':['lock-presentation','this server is going to handover to other one.']
        }
        statetree.root.pub.bus.broadcast_by_internal_node('__ALL__',data)
        # taskover_access_paths 回傳給admin.js，此client分別通知接收的host(呼叫takeover)
        taskover_access_paths = self.presentation_root_folder.handover_to_hosts(hosts_not_to_takeover,hosts_to_takeover)
        return taskover_access_paths


    @exportable
    def database_statistics(self,task):
        dbnames = [
            'user_presentation_dict',
            'presentation_states_dict',
            'token_presentation_dict',
            'presentation_atime_dict',
            'delegate_host_dict', 
            'available_host_dict',
            'active_count_dict',
            'binding_dict',
            'sbs_name_dict',
            'quickshortcut_codes_dict', 
            'quickshortcut_pids_dict',
        ]
        count = {}
        db = self.presentation_root_folder.db
        for name in dbnames:
            count[name] = len(getattr(db,name))
        
        ret = {
            'statistics':{}
        }
        for name in dbnames:
            ret['statistics'][name] = {
                'value':count[name],
                'desc':name
            }
        return ret
    database_statistics.require_task = True
statetree.root.add_node('admin',WhiteboardAdmin())