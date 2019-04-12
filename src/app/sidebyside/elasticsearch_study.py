from elasticsearch import Elasticsearch
if __name__ == '__main__':
    import base64, os
    def make_uuid(length=64):
        # return a str type
        return (base64.urlsafe_b64encode(os.urandom(length)).rstrip(b'=')).decode()    
    es = Elasticsearch()
    if 0:
        if 0:
            #index = 'user_presentation_dict'
            #index = 'token_presentation_dict'
            index = 'presentation_states_dict'
            res = es.search(index=index, body={"query": {"match_all": {}}})
            print("Got %d Hits:" % res['hits']['total'])
            for hit in res['hits']['hits']:
                print(hit['_id'],':',hit["_source"])
        if 0:
            #index = 'token_presentation_dict'
            #index = 'user_presentation_dict'
            for index in ('user_presentation_dict','token_presentation_dict','presentation_states_dict'):
                res = es.search(index=index, body={"query": {"match_all": {}}})
                print("Got %d Hits:" % res['hits']['total'])
                for hit in res['hits']['hits']:
                    print(hit['_id'],':',hit["_source"])
                es.indices.delete(index=index, ignore=[400, 404]) 
                print('index %s deleted' % index)
    if 1:
        if 0:
            # ignore 404 and 400
            es.indices.delete(index='user_assets', ignore=[400, 404])

            # ignore 400 cause by IndexAlreadyExistsException when creating an index
            es.indices.create(index='user_assets', ignore=400)    
            print ('index recreated')
        if 0:
            user_assets_doc = {
                'username':'iap',
                #'presentations':['a',['a']],
                #'presentations':['a',[1,2,3]], #error
                #'presentations':['a',['1','2']], #ok
                #'presentations':['a',['1']],#ok, 'string' and []
                #'presentations':[1,[1]],#ok,
                #'presentations':['a',1],#error, 'a',1 are of different type
                #'presentations':['a'], # error, conflict with [1] with different type
                'x':1,
                #'x':None, # ok, if x has been 1
                #'x':'x' #error, if x has been 1
            }
            #user_assets_doc = 1 #error, should be dict
            #user_assets_doc = [1,2,3] #error, should be dict
            id = '7A5EsGYfBo7qCTM6dR5nPA'

            res = es.index(id=id, index='user_assets',doc_type='user_assets',body=user_assets_doc)
            print('id=',res['_id'])
        if 0:
            res = es.search(index="user_assets", body={"query": {"match_all": {}}})
            print("Got %d Hits:" % res['hits']['total'])
            for hit in res['hits']['hits']:
                print("%(_id)s" % hit, "%(username)s: %(presentations)s" % hit["_source"])
        if 0:
            id = '7A5EsGYfBo7qCTM6dR5nPA'
            hit = es.get(index='user_assets',doc_type='user_assets',id=id)
            print (hit['_source'])
        
        if 0:
            id = '7A5EsGYfBo7qCTM6dR5nPA'
            hit = es.delete(index='user_assets',doc_type='user_assets',id=id)
            print (hit)
        
        if 0:
            ret = es.count(index='user_assets',doc_type='user_assets')
            print(ret)

        if 1:
            name = 'user_presentation_dict'
            def iter():
                page_size = 1
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
                    #print('item->',item)
                    yield item['_id'],item['_source']['value'][0]
                # Start scrolling
                remain_size = total_size - page_size
                while (remain_size > 0):
                    page = es.scroll(scroll_id = sid, scroll = '2m')
                    scroll_size = len(page['hits']['hits'])
                    for item in page['hits']['hits']:
                        yield item['_id'],item['_source']['value'][0]
                    sid = page['_scroll_id']
                    remain_size -= scroll_size
            print('iteration starts')
            for item in iter():
                print(item)