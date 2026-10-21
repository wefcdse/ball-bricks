#!/usr/bin/env python3
import argparse
import http.server
import socket
import sys
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def ipv4_addresses():
    entries = []

    try:
        import psutil
        for name, addrs in psutil.net_if_addrs().items():
            for addr in addrs:
                if addr.family == socket.AF_INET and addr.address != "0.0.0.0":
                    entries.append((name, addr.address))
    except Exception:
        entries = []

    if not entries:
        try:
            for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
                entries.append(("", ip))
        except OSError:
            pass

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.connect(("8.8.8.8", 80))
            primary = sock.getsockname()[0]
            if primary and primary != "0.0.0.0":
                entries.append(("primary", primary))
        finally:
            sock.close()
    except OSError:
        pass

    if not any(ip == "127.0.0.1" for _, ip in entries):
        entries.append(("loopback", "127.0.0.1"))

    seen = set()
    unique = []
    for name, ip in entries:
        if ip in seen:
            continue
        seen.add(ip)
        unique.append((name, ip))

    unique.sort(key=lambda item: (item[1] != "127.0.0.1", item[1]))
    return unique


class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True


def main():
    parser = argparse.ArgumentParser(description="投球砸墙本地测试服务器")
    parser.add_argument("port", nargs="?", type=int, default=8000, help="监听端口，默认 8000")
    args = parser.parse_args()

    handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    try:
        server = Server(("0.0.0.0", args.port), handler)
    except OSError as exc:
        print(f"启动失败：{exc}")
        return 1

    port = server.server_address[1]
    print()
    print("投球砸墙 本地服务")
    print(f"监听：0.0.0.0:{port}")
    print()
    print("本机访问：")
    print(f"  http://127.0.0.1:{port}/")
    print(f"  http://localhost:{port}/")
    print()
    print("局域网 / 其他网卡：")
    for name, ip in ipv4_addresses():
        if ip == "127.0.0.1":
            continue
        label = f"[{name}] " if name else ""
        print(f"  {label}http://{ip}:{port}/")
    print()
    print("0.0.0.0 会暴露到局域网；手机访问请确保同一网络并放行防火墙。")
    print("按 Ctrl+C 停止。")
    print(flush=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
