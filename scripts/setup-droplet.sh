#!/bin/bash
set -euo pipefail

echo "=== MarketingAlphaScan Droplet Setup (Hardened) ==="

# 1. System updates
apt-get update && apt-get upgrade -y

# 2. Docker repo + install
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
ARCH="$(dpkg --print-architecture)"
CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 3. Create deploy user (non-root, Docker access)
if ! id deploy &>/dev/null; then
  adduser --disabled-password --gecos "" deploy
fi
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# 4. SSH hardening
cat > /etc/ssh/sshd_config.d/hardened.conf << 'SSHEOF'
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
AllowAgentForwarding no
AllowTcpForwarding no
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes
SSHEOF
systemctl restart ssh

# 5. Firewall (UFW)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 6. fail2ban — SSH brute force protection
apt-get install -y fail2ban
cat > /etc/fail2ban/jail.local << 'F2BEOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
banaction = ufw

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
F2BEOF
systemctl enable fail2ban
systemctl restart fail2ban

# 7. Kernel hardening (network + memory)
cat > /etc/sysctl.d/99-alphascan-hardened.conf << 'SYSEOF'
# Prevent IP spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP redirects (prevent MITM)
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0

# Ignore source-routed packets
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# SYN flood protection
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2

# Ignore ICMP broadcast requests
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Log martian packets
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# Disable IPv6 if not needed
net.ipv6.conf.all.disable_ipv6 = 1
net.ipv6.conf.default.disable_ipv6 = 1

# Swap behavior (2GB droplet)
vm.swappiness = 10
vm.vfs_cache_pressure = 50

# Harden BPF
kernel.unprivileged_bpf_disabled = 1

# Restrict kernel pointer exposure
kernel.kptr_restrict = 2

# Restrict dmesg access
kernel.dmesg_restrict = 1

# Restrict ptrace
kernel.yama.ptrace_scope = 2
SYSEOF
sysctl --system

# 8. Swap (2GB for the 2GB RAM droplet)
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

# 9. App directory with strict permissions
mkdir -p /opt/alphascan/apps/engine
chown -R deploy:deploy /opt/alphascan
chmod 750 /opt/alphascan

# 10. DigitalOcean monitoring
curl -sSL https://repos.insights.digitalocean.com/install.sh | bash

# 11. Automatic security updates
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# 12. Docker daemon hardening
cat > /etc/docker/daemon.json << 'DOCKEREOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "no-new-privileges": true,
  "live-restore": true
}
DOCKEREOF
systemctl restart docker

# 13. Set .env permissions after SCP (reminder)
echo ""
echo "=== Setup complete ==="
echo ""
echo "SECURITY: After SCP-ing .env file, lock permissions:"
echo "  ssh -i ~/.ssh/do_alphascan deploy@157.230.2.203"
echo "  chmod 600 /opt/alphascan/.env"
echo ""
echo "Then deploy:"
echo "  cd /opt/alphascan && docker compose -f docker-compose.prod.yml up -d"
