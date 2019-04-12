from backend import BackendDatabase
from collections import MutableMapping
from elasticsearch import Elasticsearch
from elasticsearch.exceptions import NotFoundError, RequestError
import traceback
from twisted.internet import reactor
class ElasticSearchIndex(MutableMapping):
    def __init__(self,es_api_client,name):
        self.es = es_api_client
        self.name = name # index, doc_type
        
        # 清理資料庫時才開啟 if 1, node daemon執行，看到console有顯示重建資料庫的dump後，立刻關閉daemon (^C)。改為 if 0之後，再重新啟動daemon
        if 0:
            self.es.indices.delete(index=name, ignore=[400, 404])
            print('---------- Warning elasticsearch db "%s" is purged --------------' % name)
        
        settings = {
            'mappings':{
                name:{
                    '_all':{
                        'enabled':False
                    },
                    'properties':{
                        'value':{
                            'index':False
                        }
                    }
                }
            },

        }
        self.es.indices.create(index=name, body=settings, ignore=400) 
    def __getitem__(self,id,default=None):
        try:
            return self.es.get_source(index=self.name,doc_type=self.name,id=id)['value']
        except NotFoundError:
            raise KeyError('%s not found' % id)
    def __setitem__(self,id,value):
        try:
            self.es.index(index=self.name,doc_type=self.name,id=id,body={'value':value})
        except RequestError:
            print('failed to set id=%s to value=%s' % ([id],[value]))
            traceback.print_exc()
            reactor.stop()
    def __delitem__(self,id):
        try:
            return self.es.delete(index=self.name,doc_type=self.name,id=id)
        except NotFoundError:
            raise KeyError('%s not found' % id)
    def __len__(self):
        return self.es.count(index=self.name,doc_type=self.name)['count']
    def __iter__(self):
        page_size = 1000
        page = self.es.search(
            index = self.name,
            doc_type = self.name,
            scroll = '2m',
            size = page_size,
            body = {
                "query": {"match_all": {}}
            })
        sid = page['_scroll_id']
        total_size = page['hits']['total']
        for item in page['hits']['hits']:
            yield item['_id'],item['_source']['value']
        # Start scrolling
        remain_size = total_size - page_size
        while (remain_size > 0):
            page = self.es.scroll(scroll_id = sid, scroll = '2m')
            scroll_size = len(page['hits']['hits'])
            for item in page['hits']['hits']:
                yield item['_id'],item['_source']['value']
            sid = page['_scroll_id']
            remain_size -= scroll_size
    items = __iter__

    def keys(self):
        page_size = 1000
        page = self.es.search(
            index = self.name,
            doc_type = self.name,
            scroll = '2m',
            size = page_size,
            body = {
                "_source":False,
                "query": {"match_all": {}}
            })
        sid = page['_scroll_id']
        total_size = page['hits']['total']
        for item in page['hits']['hits']:
            yield item['_id']
        # Start scrolling
        remain_size = total_size - page_size
        while (remain_size > 0):
            page = es.scroll(scroll_id = sid, scroll = '2m')
            scroll_size = len(page['hits']['hits'])
            for item in page['hits']['hits']:
                yield item['_id']
            sid = page['_scroll_id']
            remain_size -= scroll_size
    
    def mdelete(self,ids):
        """
        暫時用比較沒效率的方式，以後改用bluk api
        """
        for id in ids:
            try:
                self.__delitem__(id)
            except KeyError:
                pass
    
    def commit(self):
        """ dummy function to be compatible with SqliteDict"""
        pass

class PresentationElasticSearchDB(BackendDatabase):
    def __init__(self,*args,**kw):
        super(PresentationElasticSearchDB,self).__init__()
        self.es = Elasticsearch(*args,**kw)        
        for name in (
            'user_presentation_dict',
            'presentation_states_dict',
            'token_presentation_dict',
            'presentation_atime_dict',
            'delegate_host_dict', 
            'available_host_dict',
            'active_count_dict',
            'statistic_dict',
            'binding_dict',
            'sbs_name_dict',
            'quickshortcut_codes_dict', 
            'quickshortcut_pids_dict',
            'handover_data_dict',
            ):
            self.make_dict(name,for_cache=False)
        # initialize statistic_dict
        for key in ('username','presentation'):
            try:
                self.statistic_dict[key]
            except KeyError:
                self.statistic_dict[key] = 0


        self.presentation_states_dict_queue = {}
        self.presentation_states_dict_timer = None
        self.presentation_states_dict_interval = 5


    def make_dict(self,name,for_cache=True,**kw):
        
        try:
            return getattr(self,name)
        except AttributeError:
            if for_cache:
                setattr(self,name,{})
            else:
                setattr(self,name,ElasticSearchIndex(self.es,name))
            return getattr(self,name)
    
    def update_presentation_state(self,p_id,p_state,sync=False):
        """
        這裡改成有throttle的方式更新presentation_states_dict，
        因為在draw的情況下， 呼叫太頻繁。每5秒更新一次即可
        Args:
            sync:(boolean) 若為真，立刻更新（刪除操作時，自動為真，例如創建新的presentation時可使用，以在不同主機之間同步）;
        """
        if p_state is None:
            del self.presentation_states_dict[p_id]
        elif sync:
            self.presentation_states_dict[p_id] = p_state
        else:
            self.presentation_states_dict_queue[p_id] = 1
            if not self.presentation_states_dict_timer:
                self.presentation_states_dict_timer = \
                    reactor.callLater(self.presentation_states_dict_interval,self.commit)
    
    def commit(self):
        p_ids = list(self.presentation_states_dict_queue.keys())
        self.presentation_states_dict_queue.clear()
        self.presentation_states_dict_timer = None
        for p_id in p_ids:
            self.presentation_states_dict[p_id] = self.presentation_states_cache[p_id][0]
    
