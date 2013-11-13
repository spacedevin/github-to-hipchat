curl -u "USERNAME" -i \
	https://api.github.com/hub \
	-F "hub.mode=subscribe" \
	-F "hub.topic=https://github.com/OWNER/REPOSITORY/events/issues" \
	-F "hub.callback=http://SERVER/github/issues"

curl -u "USERNAME" -i \
	https://api.github.com/hub \
	-F "hub.mode=subscribe" \
	-F "hub.topic=https://github.com/OWNER/REPOSITORY/events/issue_comment" \
	-F "hub.callback=http://SERVER/github/issue_comment"