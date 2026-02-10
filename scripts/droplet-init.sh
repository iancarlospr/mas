#!/bin/bash
set -euo pipefail

echo "=== MarketingAlphaScan Droplet Setup ==="

# 1. System updates
apt-get update && apt-get upgrade -y

# 2. Create deploy user (not root)
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# 3. SSH Hardening
cat > /etc/ssh/sshd_config.d/hardened.conf << 'EOF'
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
MaxAuthTries 3
LoginGraceTime 20
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers deploy
X11Forwarding no
EOF
systemctl restart sshd

# 4. Firewall (UFW)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp     # SSH
ufw allow 3001/tcp   # Engine API (will be behind Cloudflare)
ufw --force enable

# 5. Swap (critical for 1GB RAM droplet)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Optimize swap behavior for low-memory server
echo 'vm.swappiness=10' >> /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
sysctl -p

# 6. Install Docker Compose plugin (if not pre-installed)
apt-get install -y docker-compose-plugin

# 7. Create application directory
mkdir -p /opt/alphascan
chown deploy:deploy /opt/alphascan

# 8. Install DigitalOcean monitoring agent
curl -sSL https://repos.insights.digitalocean.com/install.sh | bash

# 9. Automatic security updates
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# 10. Log rotation for Docker (global)
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
systemctl restart docker

# 11. Done
echo "=== Setup complete ==="
echo "Next steps:"
echo "1. SSH as deploy: ssh deploy@<ip>"
echo "2. Login to GHCR: echo \$GHCR_TOKEN | docker login ghcr.io -u <username> --password-stdin"
echo "3. Copy docker-compose.prod.yml and .env to /opt/alphascan/"
echo "4. Run: cd /opt/alphascan && docker compose -f docker-compose.prod.yml up -d"
