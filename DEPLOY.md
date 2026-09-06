# ZAG BRAKES 部署指南 - 腾讯云轻量服务器

## 准备工作

1. 腾讯云轻量服务器一台（建议 CentOS 7+ 或 Ubuntu 20.04+）
2. Namecheap 域名 DNS 已指向服务器 IP
3. 服务器已安装 Node.js 18+

## 第一步：安装 Node.js（如未安装）

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

## 第二步：上传项目

将整个项目文件夹（不含 node_modules）上传到服务器，例如 `/home/zagbrakes/`

可以使用：
- 宝塔面板文件管理
- FTP（FileZilla）
- SCP 命令：`scp -r ./ZAGwebiste root@你的IP:/home/zagbrakes/`

## 第三步：安装依赖并启动

```bash
cd /home/zagbrakes
npm install

# 直接启动测试
node server.js
# 看到 "ZAG BRAKES Platform running at http://localhost:3000" 说明成功

# Ctrl+C 停止，然后用 PM2 后台运行
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # 设置开机自启
```

## 第四步：配置 Nginx 反向代理（可选但推荐）

```bash
sudo apt install nginx   # 或 yum install nginx

# 编辑 /etc/nginx/sites-available/zagbrakes
server {
    listen 80;
    server_name zagbrakes.com www.zagbrakes.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 上传文件大小限制
    client_max_body_size 10m;
}

sudo ln -s /etc/nginx/sites-available/zagbrakes /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 第五步：修改默认密码

编辑 `.env` 文件，修改：
```
ADMIN_PASSWORD=你的新密码
```
然后重启：`pm2 restart zag-brakes`

## 日常维护

```bash
pm2 status          # 查看运行状态
pm2 logs zag-brakes # 查看日志
pm2 restart zag-brakes  # 重启
pm2 stop zag-brakes     # 停止
```

## 更新代码

```bash
cd /home/zagbrakes
pm2 stop zag-brakes
# 上传新文件覆盖
npm install   # 如有新依赖
pm2 start zag-brakes
```

## 数据库备份

SQLite 数据库文件在 `data/zag.db`，定期备份：
```bash
cp data/zag.db data/zag.db.backup.$(date +%Y%m%d)
```
