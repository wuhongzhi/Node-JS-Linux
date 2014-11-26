#!/bin/bash
if [ -z "$1" ]; then
	echo 'Usage: addplayload [playload]'
	exit;
fi
echo '#!/bin/sh' > install.sh
echo 'decode() {' >> install.sh
echo "cat <<PLAYLOAD | uudecode" >> install.sh
cat $1 | uuencode -m - >>install.sh
echo "PLAYLOAD" >>install.sh
echo '}' >> install.sh
cat install.sh.in >> install.sh
