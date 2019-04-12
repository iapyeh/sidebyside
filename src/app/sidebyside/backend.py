from twisted.internet import reactor
from twisted.python import log
import time
import __main__
def timestamp():
    return int(time.time()) + __main__.tzoffset
class BackendDatabase(object):
    # 允許該p_state留在cache的時間，超過此時間且無人在bus房間內（無人使用）時就從cache中刪去
    alive_check_interval = 360
    # 維護cache的時間間隔
    maintain_cache_interval = 60
    def __init__(self):
        
        #
        # persistent storage
        #
        
        # A user owns what persentations?
        # 1. self.user_presentation_dict is  
        #    {username => [presentation id]}
        #self.user_presentation_dict = {}
        # Lookup presentations' data by presentation_id
        # self.presentation_dict is 
        #    {presentation_id => presentation_metadata} (relatively static data)        
        #self.presentation_states_dict = {}
        # Lookup presentation_id and flag by token
        # self.token_presentation_dict is
        #   token => (presentation_id, flag) where flag is 2(ss token) or 3(sa token)
        #self.token_presentation_dict = {}
        
        #
        # cached storage in local memory
        #
        
        # A quick way to access presentations' data by presentation_id
        # (this should not be used in cluster scenario before carefully implemented)
        # 異動性高，不宜在cluster情境下使用
        # self.presentation_dict_cache is of the same structure as presentation_dict but in memory
        #   {presentation_id => presentation_metadata} 
        #self.presentation_states_cache = {}

        # A quick way to access presentation_id and flag by token (in memory)
        # aka. cached version of self.token_presentation_dict
        # 異動性雖然不高，在cluster情境下使用時需有移除clean cache機制
        # (this should not be used in cluster scenario before carefully implemented)
        #self.token_presentation_cache = {}

        # A quick way to access presentation_id by bus_room_id (in memory)
        # 異動性雖然不高，在cluster情境下使用時需有移除clean cache機制
        #  self.bus_presentation_dict is
        #   bus_room_id => presentation_id
        #   its content is build together with self.presentation_states_cache
        #self.bus_presentation_cache = {}

        for name in (
            'presentation_states_cache',
            'token_presentation_cache',
            'bus_presentation_cache',
            ):
            self.make_dict(name,for_cache=True)  

        self.bus = __main__.statetree.root.pub.bus
        reactor.callLater(self.maintain_cache_interval, self._maintain_presentation_states_cache)
    
    def on_presentation_changed(self,p_state,sync):
        """ (might be obsoleted)
        called by presentation instances to update its state in sqlitedict
        """
        #firstly, put p_state into cache if it is not already in cache.
        p_id = p_state['id']
        try:
            self.presentation_states_cache[p_id][0] = p_state
        except KeyError:
            # 內部創建的新presentation不在cache中，所以在此加入
            # 此處維持需與 def get_presentation_state(self,p_id) 那裡的code的作法一致
            self.presentation_states_cache[p_id] = [p_state,timestamp()]
            self.bus_presentation_cache[p_state['bus']] = p_id
        else:
            self.presentation_states_cache[p_id][1] = timestamp()
        
        # secondary update database
        #reactor.callLater(0.001,lambda x=p_state:self._update_presentation_state_cache(x))
        self.update_presentation_state(p_id,p_state,sync)
    
    def on_presentation_removed(self,p_id):
        # 把這個數值設定為0，它(cache)會被 backend.py的_maintain_presentation_states_cache 所回收
        self.presentation_states_cache[p_id][1] = 0
        self.update_presentation_state(p_id, None)
    
    def _maintain_presentation_states_cache(self):
        """
        reduce memory usage of presentation_states_cache
        雖然對於降低記憶體用量沒多大的用處，但可以借此機會更新atime(last access time)
        atime可以用來清理沒有人使用的presentation
        """
        now = timestamp()
        timeout = now - self.alive_check_interval
        p_id_to_remove = []
        p_bus_to_remove = []
        p_token_to_remove = []
        p_id_to_touch = []
        before_n = len(self.presentation_states_cache)
        for p_id, p_state_cached in self.presentation_states_cache.items():
            # p_state_cached[1] 是該 p_state 被載入記憶體cache的時間
            
            if p_state_cached[1] < timeout:
                members = self.bus.get_members(p_state_cached[0]['bus'])
                if len(members) == 0:
                    p_id_to_remove.append(p_id)
                    p_bus_to_remove.append(p_state_cached[0]['bus'])
                    for p_token in p_state_cached[0]['acl_token'].values():
                        p_token_to_remove.append(p_token)
                else:
                    p_id_to_touch.append(p_id)
        
        for p_id in p_id_to_touch:
            print('>>> _maintain_presentation_states_cache touch p_id',p_id)
            self.presentation_states_cache[p_id][1] = now
        
        for p_id in p_id_to_remove:
            print('>> _maintain_presentation_states_cache remove p_id',p_id)
            p_state, ts = self.presentation_states_cache[p_id]
            del self.presentation_states_cache[p_id]
            # update atime
            self.presentation_atime_dict[p_id] = ts
        
        for p_bus in p_bus_to_remove:
            print('>>_maintain_presentation_states_cache remove p_bus',p_bus)
            del self.bus_presentation_cache[p_bus]

        for p_token in p_token_to_remove:
            try:
                del self.token_presentation_cache[p_token]
                print('>>_maintain_presentation_states_cache remove p_token',p_token)
            except KeyError:
                pass
        reactor.callLater(self.maintain_cache_interval, self._maintain_presentation_states_cache)
    
    # 以下是要被覆寫的函式
    def update_presentation_state(self,p_id,p_state):
        raise NotImplementedError('update_presentation_state()')
    
    def make_dict(self,name,for_cache=True,**kw):    
        raise NotImplementedError('make_dict()')
