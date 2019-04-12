from presentation import (
    timestamp,
)

class ClusterServerDispatcher(object):
    """
    cluster node啟動時，透過此class註冊自己到cluster中，以等待分配服務對象。
    """
    def __init__(self,host_id,access_path,db, weight=1):
        #should be unique across all members, ususally is access_path
        self.host = host_id # name of host in config.py['cluster']['name']
        self.weight = weight #weighting for dispatching load(not implemented yet)
        self.access_path = access_path
        self.delegate_host_dict = db.delegate_host_dict
        # dictionary of hostname => active users count
        self.available_host_dict = db.available_host_dict
        # 註冊此host可用
        # 注意：還要有取消註冊的機制（此問題尚未解決）
        self.available_host_dict[self.host] = {
            'access_path':self.access_path,
            'online':True,
            'uptime':timestamp()
        }
        # 活躍數，用來分配服務主機，主機離線時，需清掉（此問題尚未解決）
        self.active_count_dict = db.active_count_dict
        self.active_count = 0
        self.active_count_dict[self.access_path] = {'count':0}

    def get_delegate_host(self,lookup_id):
        """
        if lookup_id is None, delegate a host of lighter loadings
        Currently, lookup_id is ss_token which represents a board (presentation)
        """
        assert lookup_id is not None
        
        try:
            return self.delegate_host_dict[lookup_id]
        except KeyError:
            pass        
        #assign a server (by load balance priciple)
        # 注意：有可能2個使用者同時問相同的lookup_id，卻回傳不同的host(此問題尚未解決)
        selected_access_path = None
        min_active_count = 0
        for access_path, data_dict  in self.active_count_dict.items():
            if selected_access_path is None or data_dict['count'] <= min_active_count:
                min_active_count = data_dict['count']
                selected_access_path = access_path
        if lookup_id is not None:
            self.delegate_host_dict[lookup_id] = selected_access_path
        return selected_access_path
    '''
    def update_delegate_host(self,access_path,lookup_id):
        self.delegate_host_dict[lookup_id] = access_path
    '''
    def increase_active_count(self):
        self.active_count += 1
        self.active_count_dict[self.access_path] = {'count':self.active_count}
    
    def decrease_active_count(self):
        self.active_count -= 1
        self.active_count_dict[self.access_path] = {'count':self.active_count}
    
    '''
    def handover_to_hosts(self,presentation_root_folder, hosts_not_to_takeover=None,hosts_to_takeover=None):
        """
            hosts_not_to_takeover:(list of string) 原則上本機服務中的簡報會轉移到其他所有上線中的主機，
                    但如果其他也有主機預備關機，則要排除那些主機接手；用黑名單的方式列舉之。
            hosts_to_takeover:(list of string)同上，也可以用白名單的方式，指定要分配到哪些主機。        
        """
        
        #尋找可接手的主機
        available_hosts_to_takeover = {}
        if hosts_to_takeover is not None:
            for host_id in hosts_to_takeover:
                if host_id == self.host: continue
                try:
                    host_data = self.available_host_dict[host_id]
                    if host_data['online']:
                        available_hosts_to_takeover[host_id] = host_data
                except KeyError:
                    continue
        else:
            if hosts_not_to_takeover is None:
                hosts_not_to_takeover = [self.host]
            else:
                hosts_not_to_takeover.append(self.host)
            
            for host_id, host_data in self.available_host_dict.items():
                if host_id in hosts_not_to_takeover: continue
                if host_data['online']:
                    available_hosts_to_takeover[host_id] = host_data

        if len(available_hosts_to_takeover) == 0:
            log.warn('no server to take over host %s' % self.host)
            return
        
        # 根據weight排序（還沒實作）
        available_access_paths = []
        for host_id, host_data in available_hosts_to_takeover.items():
            available_access_paths.append(host_data['access_path'])
        
        #不會再被分配給新的簡報連線(但新連線到既有服務中的簡報還是可以的)
        del self.active_count_dict[self.access_path]
        # 取消available_host_dict中的註冊
        self.available_host_dict[self.host] = {
            'access_path':self.access_path,
            'online':False,
            'downtime':timestamp()
        }
        # 分配presentation到其他主機
        takeover_host = {}
        cursor = 0
        total_number = len(available_access_paths)
        # 這個方式很沒效能，未來要改掉,不必一個一個問；而且只要轉移有人使用的board就好
        for ss_token, access_path in self.delegate_host_dict.items():
            if access_path == self.access_path:
                access_path = available_access_paths[ cursor % total_number]
                takeover_host[access_path] = {'ss_token':ss_token}
                cursor += 1
        # 把ss_token 轉成 p_id (複製目錄）bus（通知,新的host）,
        for access_path,data in takeover_host.items():
            p_state = presentation_root_folder.get_presentation_state_token(data['ss_token'],2)
            data['bus'] = p_state['bus']
            data['p_id'] = p_state['id']
            data['relpath'] = get_presentation_path(p_state['owner'],p_state['id'])
            # 寫入交接字典，每個接收host會從admin.html收到通知(takeover)，並開始複製資料
            self.handover_data_dict[access_path] = data
        taskover_access_paths = takeover_host.keys()
        return list(taskover_access_paths)
    
    def takeover_from_host(self,presentation_root_folder):
        # 這個方式很沒效能，未來要改掉,不必一個一個問；而且只要轉移有人使用的board就好
        for access_path, data in self.handover_data_dict.items():
            if access_path == self.access_path:
                # 複製檔案
                relpath = data['relpath']
                presentation_root_folder.filestore_agent.resync_from_filestore(relpath)
                # 更改delegate host到自己
                self.delegate_host_dict[data['ss_token']] = access_path
    '''

class FilestoreAgent(object):
    def __init__(self,client):
        self.client = client
        self.client.start()