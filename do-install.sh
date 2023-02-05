#!/bin/bash
# install script for mdNOSH in a DigitalOcean Ubuntu Droplet
set -e
if [[ $EUID -ne 0 ]]; then
	echo "This script must be run as root.  Aborting." 1>&2
	exit 1
fi
if [ -x "$(command -v docker)" ]; then
  echo "Docker already installed"
else
  apt install -y ca-certificates curl gnupg lsb-release
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
read -e -p "Enter your Name: " -i "" NAME
read -e -p "Enter your Root Domain Name (domain.com): " -i "" ROOT_DOMAIN
read -e -p "Enter your E-Mail address for Let's Encrypt (your@email.com): " -i "" EMAIL
read -e -p "Enter your 4-digit encryption PIN: " -i "" COUCHDB_PIN
read -e -p "Enter your CouchDB/Traefik Password for admin user: " -i "" COUCHDB_PASSWORD
read -e -p "Enter your Magic API Key for NOSH: " -i "" MAGIC_API_KEY 
read -e -p "Enter your USPSTF API Key for NOSH: " -i "" USPSTF_KEY
read -e -p "Enter your UMLS API Key for NOSH: " -i "" UMLS_KEY
mkdir nosh3
cd nosh3
curl -o- https://raw.githubusercontent.com/shihjay2/nosh3/main/docker-compose.yml
curl -o- https://raw.githubusercontent.com/shihjay2/nosh3/main/.env
sed -i "s/example@example.com/$EMAIL/" ./docker-compose.yml
sed -i "s/example.com/$ROOT_DOMAIN/" ./docker-compose.yml
sed -i "s/example.com/$ROOT_DOMAIN/" ./.env
sed -i '/^MAGIC_API_KEY=/s/=.*/='"$MAGIC_API_KEY"'/' ./.env
sed -i '/^USPSTF_KEY=/s/=.*/='"$USPSTF_KEY"'/' ./.env
sed -i '/^UMLS_KEY=/s/=.*/='"$UMLS_KEY"'/' ./.env
sed -i '/^COUCHDB_USER=/s/=.*/='"admin"'/' ./.env
sed -i '/^COUCHDB_PASSWORD=/s/=.*/='"$COUCHDB_PASSWORD"'/' ./.env
sed -i '/^COUCHDB_ENCRYPT_PIN=/s/=.*/='"$COUCHDB_PIN"'/' ./.env
sed -i '/^INSTANCE=/s/=.*/='"docker"'/' ./.env
sed -i '/^NOSH_ROLE=/s/=.*/='"provider"'/' ./.env
sed -i '/^NOSH_EMAIL=/s/=.*/='"$EMAIL"'/' ./.env
sed -i '/^NOSH_DISPLAY=/s/=.*/='"$NAME"'/' ./.env
# start docker
/usr/bin/docker compose up -d
echo "Initializing CouchDB and NOSH..."
sleep 5
echo "Installation complete.  You can now open your browser to https://$ROOT_DOMAIN/start" 
exit 0
