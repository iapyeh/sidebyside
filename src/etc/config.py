#! -*- coding:utf-8 -*-
#version = '20181216-1'
developing_mode = True
import datetime, os, __main__, sys
PY3 = sys.version_info[0] == 3

def rel_to_user_path(path,subname=None):
    if subname is None: subname = '.objsh'
    user_home = os.path.expanduser('~')
    abspath = os.path.normpath(os.path.join(user_home,subname,path))
    assert os.path.exists(abspath),'%s not found' % abspath
    return abspath

# relative to this file
etc_folder = os.path.abspath(os.path.dirname(__file__))
def rel_to_etc_path(path):
    return os.path.abspath(os.path.normpath(os.path.join(etc_folder,path)))

# relative to src/objsh.py
if hasattr(__main__,'objsh'):
    #invoking by app.py
    src_folder = os.path.abspath(os.path.dirname(__main__.objsh.__file__))
else:
    src_folder = os.path.abspath(os.path.dirname(__main__.__file__))

def rel_to_src_path(path):
    return os.path.normpath(os.path.join(src_folder,path))
def rel_to_default_etc_path(path):
    return os.path.normpath(os.path.join(src_folder,'../etc',path))

folder = {
    'var':rel_to_etc_path('../var'),
    'etc' : rel_to_etc_path('./'),

    # point to system secret folder
    'secret': rel_to_src_path('../etc/secret'),

    # point to system sshclientkeys
    'opt' : rel_to_etc_path('../opt'),
}

def rel_to_opt_path(path):
    return os.path.normpath(os.path.join(folder['opt'],path))

def rel_to_secret_path(path):
    return os.path.normpath(os.path.join(folder['secret'],path))

def rel_to_var_path(path):
    return os.path.normpath(os.path.join(folder['var'],path))

# default is sysrunner/,  you can add extra folder
folder['runners'] = [rel_to_opt_path('runner')]

acl_options = {
    'pam':{
        'kind':'PAM',

        # prefix to username while doing authentication
        # ex. pam_username_prefix='nas', and client of username='admin' requests for login
        # pam will check credentials for "nas_admin" in the system account
        'username_prefix':'',

        # allow for all acccounts in system accounts
        #'username':('*',) 
        
        # username should include prefix if pam_username_prefix is not empty string
        'usernames':('me',),
    },
    'debuging':{
        'kind':'IN_MEMORY_ACCOUNTS',
        'accounts':{
            'playground':'1234',
            'admin':'' # account of empty password is ignored
        }
    },
    # folders to search client_publickeys
    'client_publickeys': (
        rel_to_src_path('../etc/sshclientkeys'), #in objsh's default src
        rel_to_etc_path('sshclientkeys'),        #in etc
    ),
    # LDAP
    # 
    'ldap':{
        'kind':'LDAP',
        'basedn':'dc=example,dc=com',
        'host':'192.168.56.100',
        'port':389,
        'dn':'uid=%(username)s,ou=People,dc=example,dc=com',
        'uid_attrname':'uid',#attribute to check username, search query will be (uid=%(name)s)
    }
}
# REF: to create crt and key: https://www.akadia.com/services/ssh_test_certificate.html
# ssl key pairs to use
ssl = {
    'default':{
        'key' : rel_to_secret_path('ssl.key'),
        'crt' : rel_to_secret_path('ssl.crt'),
    }
}

general = {
    'server_name':'Bstor NAS System',
    'developing_mode': developing_mode,
    'folder':folder,
    'log':{
        'filename' : 'objsh.log',
        # values: debug(log all,default), info, warn, error, fatal
        'min_log_level':'debug' if developing_mode else 'info',
    },
    'daemon':{
        'ssh':{
            'type':'ssh',
            'enable':True,
            'port':1722,
            'server_rsa_private': rel_to_default_etc_path('secret/ssh_host_rsa_key'),
            'server_rsa_public': rel_to_default_etc_path('secret/ssh_host_rsa_key.pub'),
            'server_rsa_private_passphrase':'1234',
            # change this in productive environment
            # REF: http://twistedmatrix.com/documents/16.1.0/_downloads/sshsimpleserver.py
            # REF: https://www.freebsd.org/cgi/man.cgi?query=ssh-keygen&sektion=1&manpath=OpenBSD+3.9
            'primes':{
                2048: [(2, 24265446577633846575813468889658944748236936003103970778683933705240497295505367703330163384138799145013634794444597785054574812547990300691956176233759905976222978197624337271745471021764463536913188381724789737057413943758936963945487690939921001501857793275011598975080236860899147312097967655185795176036941141834185923290769258512343298744828216530595090471970401506268976911907264143910697166165795972459622410274890288999065530463691697692913935201628660686422182978481412651196163930383232742547281180277809475129220288755541335335798837173315854931040199943445285443708240639743407396610839820418936574217939)],
                4096: [(2, 889633836007296066695655481732069270550615298858522362356462966213994239650370532015908457586090329628589149803446849742862797136176274424808060302038380613106889959709419621954145635974564549892775660764058259799708313210328185716628794220535928019146593583870799700485371067763221569331286080322409646297706526831155237865417316423347898948704639476720848300063714856669054591377356454148165856508207919637875509861384449885655015865507939009502778968273879766962650318328175030623861285062331536562421699321671967257712201155508206384317725827233614202768771922547552398179887571989441353862786163421248709273143039795776049771538894478454203924099450796009937772259125621285287516787494652132525370682385152735699722849980820612370907638783461523042813880757771177423192559299945620284730833939896871200164312605489165789501830061187517738930123242873304901483476323853308396428713114053429620808491032573674192385488925866607192870249619437027459456991431298313382204980988971292641217854130156830941801474940667736066881036980286520892090232096545650051755799297658390763820738295370567143697617670291263734710392873823956589171067167839738896249891955689437111486748587887718882564384870583135509339695096218451174112035938859)],
            },
            #
            # sshclient_pubkey_folders is a tuple of folders which contains clients' public key.
            # gen a key pair: $ ckeygen -t rsa -f <username>
            # then, copy <username>.pub to etc/sshclientkeys folder
            # key files in the given folders must ended with .pub
            #            
            'acls':['pam','debuging','client_publickeys']
        },
        # telnet localhost 1723
        'telnet':{
            'type':'telnet',
            'enable':True,
            'port':1723,
            'acls':['pam','debuging']
        },
        # telnet-ssl -z ssl localhost 1724
        'telnet-ssl':{
            'type':'telnet',
            'enable':True,
            'port':1724,
            'ssl':ssl['default'],
            'acls':['pam','debuging']
        },
        'http':{
            'type':'web',
            'enable':True,
            'port':1780,
            'max_failure':30,
            'path':'/',
            'access_path':'/',
            'websocket':{
                'enable':True,
                'port':0,
                'route':'/ws'
            },
            #'acls':['pam','debuging','ldap'],
            'acls':['pam','debuging','ldap'],

            #'allow_cross_origin': False,#True if developing_mode else False,
            'allow_cross_origin': True, #  developing_mode

            # root folder of static file if http daemon enabled
            # Attention:/login, /login, /run, /websdk is reserved
            'htdocs' :{
                '/': {
                    'path':rel_to_opt_path('htdocs'),#document root /,
                    'public':True,
                    },
                '/private':{
                    'path':rel_to_opt_path('htdocs_private'),
                    'public':False,
                    }
            }
        },
        'https':{
            'type':'web',
            'enable':True,
            'port':1443,
            'max_failure':30,
            'ssl':ssl['default'],
            'path':'/',
            'access_path':'/',
            'websocket':{
                'enable':True,
                'port':0,
                'route':'/ws'
            },
            'acls':['pam','debuging'],

            #'allow_cross_origin': False,#True if developing_mode else False,
            'allow_cross_origin': True, #  developing_mode
            
            # root folder of static file if http daemon enabled
            # Attention:/login, /login, /run, /websdk is reserved
            'htdocs' :{
                '/': {
                    'path':rel_to_opt_path('htdocs'),#document root /,
                    'public':True,
                    },
                '/private':{
                    'path':rel_to_opt_path('htdocs_private'),
                    'public':False,
                    }
            }           
        },
        'tcpclient':{
            'type':'tcpsocket',
            'enable':True,
            'port':1725,
            'acls':['pam','debuging']
        },
        'tlsclient':{
            'type':'tcpsocket',
            'enable':True,
            'port':1726,
            'ssl':ssl['default'],
            'acls':['pam','debuging']
        }
    }
}
#
# playground settings
#
playground = {
    'enable':'yes',
    'sidebar':[
        {'Documents':[
            {'title':'BStor GDrive','url':'https://drive.google.com/drive/u/0/folders/1M8sWoDBbogpr3mdmd7SfpF7g5Glgqqqs'},
            {'API':[
                {'title':'API 試行規則', 'url':'https://docs.google.com/spreadsheets/d/1ToYI_NyJQmxnqYSYe7-zXwyuW3TXPgRgFGNIRfmRYVw/edit#gid=678031444'},
                {'title':'API 設計參考原則', 'url':'http://iapyeh.readthedocs.io/en/latest/blogs/technical/API_Guide.html'}
                ]
            }]
        }
    ]
}

statetree = {
    # used to register runner command in runner_state.py
    'runner_name':'bstor',
    'factory':rel_to_opt_path('state/mystatetree.py'),
    # used in plugin script to refrence the statetree
    'global_name':'statetree',
    'plugin_folders' : [rel_to_opt_path('state/plugins')],
    'sidebar':{
        'menuitems':[
            {'title':'Documents',
             'items':[
                    {'title':'Trello','url':'https://trello.com/b/nSKtdinn/bstor-nas-development'},
                    {'title':'BStor GDrive', 'url':'https://drive.google.com/drive/u/0/folders/1M8sWoDBbogpr3mdmd7SfpF7g5Glgqqqs'},
                    {'title':'API 試行規則', 'url':'https://docs.google.com/spreadsheets/d/1ToYI_NyJQmxnqYSYe7-zXwyuW3TXPgRgFGNIRfmRYVw/edit#gid=678031444'},
                    {'title':'API 設計參考原則', 'url':'http://iapyeh.readthedocs.io/en/latest/blogs/technical/API_Guide.html'}
                    ]
            }
        ]
    },
    'preference': {
        'save_to_folder':rel_to_var_path('preference'),
        'default':{}
    },
    # url path to export node to web (starts with /)
    # To disable, please set 'route':None 
    'route':'/bstor'
}

runner = {
    'ttl': 3600, # background task ttl
    'maintenance_interval':30 # maintenance of cache result of background tasks
}

'''
# An example to monkey patch log format
from twisted.python import log
_msg = log.msg
def my_config_msg(*message,**kw):
    message = (':^_^:',)+message
    return _msg(*message,**kw)
log.msg = my_config_msg
'''
#
# **DONT_TOUCH_BELOW**
#
# Lines blow will be reserved even config file has reset to default
#
#def debug(s):
#    sys.stderr.write(s+'\n')

developing_mode = True
general['developing_mode'] = developing_mode
#general['log']['min_log_level'] = 'info'

# for loading app modules
sys.path.insert(0,rel_to_opt_path('../app/sidebyside'))

import sys
# 這跟@resource這一類的API call的URL路徑有關
# 例如，用URL呼叫時，http://localhost:2880/@/root/admin/hello
# @ 是statetree['route'], root 是固定的
# admin 是 WhiteboardAdmin 物件(by statetree.root.add_node('admin',WhiteboardAdmin()))
# get_delegate_host_table 是 WhiteboardAdmin的@resource
statetree['route'] = '@'

# 這跟@exportable這一類的API，用websocket或用web url 呼叫有關
# 例如用URL呼叫時，http://localhost:2880/run/wb.root.admin.get_delegate_host_table
# /run 是固定的； wb 是statetree['runner_name'], root 是固定的，
# admin 是 WhiteboardAdmin 物件(by statetree.root.add_node('admin',WhiteboardAdmin()))
# get_delegate_host_table 是 WhiteboardAdmin的@exportable
statetree['runner_name'] = 'wb'

# load user's specific config of sidebyside into "config.sidebyside_config"
user_whiteboard_folder = os.path.expanduser(os.environ.get('USER_WHITEBOARD_FOLDER','~/.whiteboard'))
folder['var'] = os.path.join(user_whiteboard_folder,'var')

# because folder['var']is changed, so these value should be updated
statetree['preference']['save_to_folder'] = rel_to_var_path('preference')

#folder['opt'] = rel_to_userhome('Dropbox/workspace/ObjectiveShell/trees/iap_sidebyside3/opt')
#sys.path.insert(0,rel_to_opt_path('../app/pymodule'))
#statetree['plugin_folders'] = [rel_to_opt_path('state/plugins')]
#statetree['factory'] = rel_to_opt_path('state/mystatetree.py')

general['daemon']['tcpclient']['enable'] = False
general['daemon']['tlsclient']['enable'] = False
general['daemon']['telnet']['enable'] = False
general['daemon']['telnet-ssl']['enable'] = False
general['daemon']['ssh']['enable'] = False
general['daemon']['https']['enable'] = False
general['daemon']['https']['websocket']['enable'] = True
general['daemon']['https']['websocket']['route'] = '/ws'
general['daemon']['https']['websocket']['port'] = 0

general['daemon']['http']['port'] = 2880
general['daemon']['http']['websocket']['route'] = '/ws'
general['daemon']['http']['websocket']['port'] = 0
general['daemon']['http']['allow_cross_origin'] = True
general['daemon']['https']['allow_cross_origin'] = True
acl_options['sidebyside_admin'] = {
    'kind':'IN_MEMORY_ACCOUNTS',
    'accounts':{}
}
general['daemon']['http']['acls'] = ['pam','sidebyside_admin']
general['daemon']['https']['acls'] = ['pam','sidebyside_admin']
# sidebyside_config is an dict, it will be accessed by
# /@/sidebyside/config with "var sidebyside_config"

if os.path.exists(os.path.join(user_whiteboard_folder,'config_whiteboard.py')):
    """
template for config_whiteboard.py:
config = {
    'https':{ #behind proxy (ex. nginx)
        'enable':False,
        'host':None,
        'port':1443, # static content
        'protocol':'wss',
        'path':'/sidebyside',# browser存取靜態檔案html, js, css 的路徑；在nginx之後時有用
        'access_path':'/', # browser存取動態request（login, upload)的路徑；在nginx之後時有用
        'websocket':{
            'enable':True,
            'port': 1444, # websocket connection via port，與wss_route互斥，wss_route優先
            'route':None, # websocket connection via path，與wss_route互斥，wss_route優先
        }
    },
    'http':{
        'enable':False,
        'host':None, # ws client to login to (None for same host)
        'port':2780, # static content
        'path':'/', ,# browser存取靜態檔案html, js, css 的路徑；在nginx之後時有用
        'access_path':'/',# browser存取動態request（login, upload)的路徑；在nginx之後時有用
        'websocket':{
            'enable':True,
            'port': 0, # websocket connection via port，與wss_route互斥，wss_route優先
            'route':'/sidebysidews', # websocket connection via path，與wss_route互斥，wss_route優先
        }
    },
    #（如果有cluster時，此設定會被cluster覆寫）
    'profile':{  
        'name':'My Whiteboard',
        'max_slides':10
        'host':'127.0.0.1', #連線此server的host,在cluster時是總入口的hostname(不含port)
    },
    #（如果有cluster時，此設定會被cluster覆寫）
    'acl': {
        'admin': 'admin',
        'password':'1234',
        'public':True
    },
    #（如果有cluster時，此設定會被cluster覆寫）
    # in seconds, some proxy requires to keep websocket alive
    # set 0 to disable
    'heartbeat':0, 
    'cluster':{
        'enable':False,
        'name':'name',#register name of this deamon instance
        'server_url':'http://127.0.0.1:9200' # elasticsearch server,
        'access_path': '/sidebyside93',
    }
}
    """
    sys.path.insert(0,user_whiteboard_folder)
    import importlib
    _config_whiteboard = importlib.import_module('config_whiteboard')
    whiteboard_configurations = _config_whiteboard.config
    sys.path.remove(user_whiteboard_folder)
else:
    whiteboard_configurations = {}

sidebyside_acl = whiteboard_configurations.get('acl')
if sidebyside_acl is None:
    sidebyside_acl = {
        'admin': 'admin', #admin account username
        'password':'1234', #admin account password
        'public':True
    }
#enforce to be public for whiteboard system (by call login with type=sbs)
sidebyside_acl['public'] = True

#set admin account
acl_options['sidebyside_admin']['accounts'] = {sidebyside_acl['admin']:sidebyside_acl['password']}

# set default settings
# "server" helps sbs_user to generate correct url to link back
# especially for cross-site developing or deploment behind proxy

if whiteboard_configurations.get('https') is None:
    whiteboard_configurations['https'] = copy.deepcopy(whiteboard_configurations['https'])
else:
    #apply custome settings to override default settings
    general['daemon']['https'].update( whiteboard_configurations['https'])


if whiteboard_configurations.get('http') is None:
    whiteboard_configurations['http'] = copy.deepcopy(whiteboard_configurations['http'])
else:
    #apply custome settings to override default settings
    general['daemon']['http'].update( whiteboard_configurations['http'])

if whiteboard_configurations.get('profile') is None:
    whiteboard_configurations['profile'] = {
        'name':'Whiteboard展示系統',
        'host':'127.0.0.1',
        # maximim number of slides per presentation, 0 is same as 100
        'max_slides':10
    }
    
#apply custome settings to override default settings
general['server_name'] = whiteboard_configurations['profile']['name']

# if "heartbeat" (in seconds) is not 0, sbs_user will ping back periodically
if whiteboard_configurations.get('heartbeat') is None:
    whiteboard_configurations['heartbeat'] = 0 #seconds


# An example to monkey patch log format
'''
from twisted.python import log
_msg = log.msg
def my_config_msg(*message,**kw):
    level = kw.get('log_level')
    message = (':^%s:%s^:' % (level,type(level)=='debug'),)+message
    return _msg(*message,**kw)
log.msg = my_config_msg
'''

# benchmark settings
general['daemon']['ssh']['enable'] = False

# cluster settings:
# 1. 可修改~/.whiteboard/config_whiteboard.cluster更改設定
# 2. 如果enable，則此dict會從objctstore取得更多的設定，見 etc/setcluster.py
whiteboard_cluster = {
    'enable':False,
    'name':'#server#93', 
    'weight':1,
    'objectstore_url':'http://localhost:9200',  #enable時，object store所在的存取路徑,
    'filestore':{
        'module_path':'~/Dropbox/workspace/filestore/filesotre', # where filesotre/client.py exists
        'repository_mount_path':None
    }
}

if whiteboard_configurations.get('cluster') is not None:
    whiteboard_cluster.update(whiteboard_configurations['cluster'])

if whiteboard_cluster['enable']:
    # get cluster-wide settings
    from setcluster import get_cluster_config,get_connection
    es = get_connection(whiteboard_cluster['objectstore_url'])
    cluster_settings = get_cluster_config(es)
    es.transport.close()
    
    # replace acl,profile,heartbeat by cluster-wide settings
    for key in ('profile','acl'):
        whiteboard_configurations[key].update(cluster_settings[key])
        del cluster_settings[key]
    whiteboard_configurations['heartbeat']= cluster_settings['heartbeat']
    del cluster_settings['heartbeat']

    # set __main__.cookie_domain
    __main__.cookie_domain = cluster_settings['domain']

    # cluster_settings will be updated whiteboard_cluster from object-store but exclude these keys
    # which means "domain","filestore" been updated to whiteboard_cluster
    whiteboard_cluster['filestore'].update(cluster_settings['filestore'])
    

    # reset admin account to be cluster's setting
    acl_options['sidebyside_admin']['accounts'] = {whiteboard_configurations['acl']['admin']:whiteboard_configurations['acl']['password']}

else:
    # set __main__.cookie_domain
    __main__.cookie_domain = None

# global_config will be requested by client
global_config = {}
for key in ('http','profile','heartbeat'):
    value = whiteboard_configurations.get(key)
    if value is not None:
        global_config[key] = value
global_config_secure = {}
for key in ('https','profile','heartbeat'):
    value = whiteboard_configurations.get(key)
    if value is not None:
        global_config_secure[key] = value
