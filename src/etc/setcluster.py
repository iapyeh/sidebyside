"""
把cluster的訊息設定到elasticsearch，讓連接上來的cluster member取用
取代在config.py當中設定cluster的資料
"""
import os,sys
from elasticsearch import Elasticsearch
name = 'cluster-settings'
id = 'stores'
stores_config = {
    'domain':'.neusauber.com',
    'filestore':{
        'socketclient':{#authentication and connection options for creating socket-client of filestone
            'host':'140.109.18.131',
            'port':1923,
            'runner_name':'filestore',
            'resource_route_name':'filestore', # statetree['route'] in config.py
            'username':'playground',
            'password':'1234'
        }
    },
    # 覆寫每個member的profile當中的某些參數
    'profile':{
        'name':'ClusterBoard',
        'max_slides':100,
    },
    # 覆寫每個member的acl參數
    'acl': {
        'admin': 'admin',
        'password':'1234',
        'public':True
    },
    # 覆寫每個member的heartbeat參數
    'heartbeat':180,
}
def get_connection(server_url):
    print('server = ',server_url)
    print('Elasticsearch=',Elasticsearch)
    try:
        es = Elasticsearch(server_url,use_ssl=False)
    except:
        sys.exit(1)
    return es

def set_cluster_config(es,id,value):
    settings = {
        'mappings':{
            name:{
                '_all':{
                    'enabled':False
                }
            }
        },
        'properties':{
            'value':{
                'index':False
            }
        }
    }
    es.indices.create(index=name, body=settings, ignore=400)
    es.index(index=name,doc_type=name,id=id,body={'value':value})

def get_cluster_config(es,key=None):
    if key is None: key = id
    return es.get_source(index=name,doc_type=name,id=key)['value']

def iter(es,name):
    page_size = 1000
    page = es.search(
        index = name,
        doc_type = name,
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
        page = es.scroll(scroll_id = sid, scroll = '2m')
        scroll_size = len(page['hits']['hits'])
        for item in page['hits']['hits']:
            yield item['_id'],item['_source']['value']
        sid = page['_scroll_id']
        remain_size -= scroll_size    

def keys(es,name):
    page_size = 1000
    page = es.search(
        index = name,
        doc_type = name,
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
        #yield item
    # Start scrolling
    remain_size = total_size - page_size
    while (remain_size > 0):
        page = es.scroll(scroll_id = sid, scroll = '2m')
        scroll_size = len(page['hits']['hits'])
        for item in page['hits']['hits']:
            #yield item
            yield item['_id']
        sid = page['_scroll_id']
        remain_size -= scroll_size

def cleanup(es,name):
    keys = []
    print(name+' dumps before cleanup-----')
    for key, value in iter(es,name):
        print (key,'=',value)
        keys.append(key)
    for key in keys:
        es.delete(index=name,doc_type=name,id=key)
        print('delete',key)
    print(name+' dumps after cleanup-----')
    for key, value in iter(es,name):
        print (key,'=',value)
        keys.append(key)

def delete(es,name):
    es.indices.delete(index=name, ignore=[400, 404])

if __name__ == '__main__':
    #elasticsearch server
    object_store = {
        'host':'140.109.18.131',
        'port':9200,#default port
        'credential':'', #username:password
    }
    if object_store['credential']: object_store['credential'] += '@'
    server_url = 'http://%(credential)s%(host)s:%(port)s/' % object_store
    es = get_connection(server_url)
    if 0:
        # 一個空白的elasticsearch backend從此開始
        set_cluster_config(es, id,stores_config)
    elif 1:
        print('settings=',get_cluster_config(es,id))
    elif 0:
        name = 'sbs_name_dict'
    elif 0:
        # clean up available servers
        # 把所有的資料庫紀錄都清掉
        names = [
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
            'handover_data_dict',
        ]
        for name in names:
            print('cleanup objects of',name)
            #cleanup(es,name)
            delete(es,name)
    elif 0:
        for key in keys(es,'sbs_name_dict'):
            print('user in sbs_name=',key)
        for key in keys(es,'user_presentation_dict'):
            print('user=',key)
        for key,value in iter(es,'binding_dict'):
            print('binding dict',key,'=',value)