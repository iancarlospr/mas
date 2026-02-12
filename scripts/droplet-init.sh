#!/bin/bash
set -euo pipefail

echo "=== MarketingAlphaScan Droplet Setup ==="

# 1. System updates
apt-get update && apt-get upgrade -y

# 2. Install Docker Engine
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 3. Create deploy user (not root)
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
ufw allow 80/tcp     # HTTP (Caddy → HTTPS redirect)
ufw allow 443/tcp    # HTTPS (Caddy SSL termination)
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
echo ""
echo "Next steps (run as deploy user):"
echo "1. SSH as deploy: ssh deploy@<ip>"
echo "2. Login to GHCR: echo \$GHCR_TOKEN | docker login ghcr.io -u <username> --password-stdin"
echo "3. Copy files to droplet:"
echo "   scp docker-compose.prod.yml apps/engine/Caddyfile deploy@<ip>:/opt/alphascan/"
echo "   scp .env.engine deploy@<ip>:/opt/alphascan/.env"
echo "4. On droplet: mkdir -p /opt/alphascan/apps/engine"
echo "   mv /opt/alphascan/Caddyfile /opt/alphascan/apps/engine/Caddyfile"
echo "5. Pull & start: cd /opt/alphascan && docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d"
echo "6. Verify: curl https://engine.marketingalphascan.com/engine/health"
