import config
import socket
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

def main():
    """
    # 將本機的簡報複製到filestore去
    # 注意：必須確保本機的簡報是最新的
    要做的檔案維護如下：
    filestore的repository:
        A1在objectstore的presentation之外的presentation目錄要刪除（已經過時的目錄，可能是測試開發過程所產生的）
    本機（非filestore的機器）
        當本機停止時進行
            B1在objectstore的presentation之外的presentation目錄要刪除（已經過時的目錄，可能是測試開發過程所產生的）
        當本機啟動時
            B2將本機經過B1之後存在的目錄複製到filestore的repository
    維護步驟：
        對於每一個member server，且包含filestore的那一台，作一次B1。讓objectstore與filestore同步
        在filestore的那一台作一次A1
        對於每一個member server，但不包含filestore的那一台，作一次B2
    """
    
    # 知道目前是否是在filestore host，關係到可以執行哪一類維護，這個很重要
    my_ip = get_ip()
    filestore_ip = config.whiteboard_cluster['filestore']['ip']
    is_filestore_host = False
    if filestore_ip == '127.0.0.1' or filestore_ip == my_ip:
        is_filestore_host = True

    
    task = 'B1'

def A1():
    pass

if __name__ == '__main__':
    main()