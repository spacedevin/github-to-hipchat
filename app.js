/**
 * Forwards github events to hipchat chanels
 *
 * note that this wont work for really busy repositories
 */

var
	express = require('express'),
	app = express(),
	request = require('request'),
	token = process.env.HIPCHAT_TOKEN || 'YOUR_TOKEN',
	room = process.env.HIPCHAT_ROOM || 'ROOM_ID',
	server = 'https://api.hipchat.com',
	queue = [], running = false, users = [], queueTimer = null;


app.use(express.bodyParser());

app.all('/', function(req, res) {
	res.end();
});

// when we get a comment request
app.post('/github/issue_comment', function(req, res) {
	var data = JSON.parse(req.body.payload);
	
	if (data.action == 'created' && data.issue && data.comment) {
		addToQueue({
			type: 'comment',
			data: data
		});
	}

});

// when we get an issue request
app.post('/github/issues', function(req, res) {
	var data = JSON.parse(req.body.payload);

	if (data.action == 'closed' && data.issue) {
		addToQueue({
			type: 'issue',
			data: data
		});
	}
	
	res.end();
});

// add item to que
var addToQueue = function(item) {

	checkUser(item.data.sender);

	var i = item.data.issue.id;
	var u = item.data.sender.id;

	if (!queue[u]) {
		queue[u] = [];
	}
	if (!queue[u][i]) {
		queue[u][i] = [];
	}

	queue[u][i].push(item);
	triggerQueue();
};

// make sure we have the users data
var checkUser = function(u) {
	if (users[u.id]) {
		return;
	}

	request.get({url: u.url, json: true}, function(error, response, user) {
		if (!error && response.statusCode == 200) {
			users[u.id] = user.name;
		}
	});
};

// lazily return the user
var getDisplayUser = function(u) {
	return users[u.id] || u.login;
};

// instead of an interval, just trigger the que being processed when it needs it
var triggerQueue = function() {
	clearTimeout(queueTimer);
	queueTimer = setTimeout(processQueue, 3000);
};

// process queue so we can group comments and issue closings
var processQueue = function() {
	if (!queue.length || running) {
		return;
	}

	running = true;
	
	// only has 15 seconds to finish. otherwise it will try again
	setTimeout(function() {
		running = false;
	}, 15000);
	
	// each user
	for (var u in queue) {
		// each issue
		for (var i in queue[u]) {
			// first make sure we have a close action. if its just a comment we dont care.

			if (!queue[u][i]) {
				continue;
			}

			var closeAction = false;
			for (var x in queue[u][i]) {
				if (queue[u][i][x].type == 'issue' && queue[u][i][x].data.action == 'closed') {
					closeAction = queue[u][i][x];
				}
			}
			
			if (closeAction) {
				var message = 'Closed issue <a href="' + closeAction.data.issue.html_url + '">#' + closeAction.data.issue.number + '</a>: <a href="' + closeAction.data.issue.html_url + '">' + closeAction.data.issue.title + '</a>';

				for (var x in queue[u][i]) {
					// each comment
					if (queue[u][i][x].type == 'comment') {
						message += '<br>' + queue[u][i][x].data.comment.body;
					}
				}

				request.post(server + '/v1/rooms/message').form({
					message_format: 'html',
					format: 'json',
					auth_token: token,
					room_id: room,
					from: getDisplayUser(queue[u][i][x].data.sender),
					message: message
				});
			}	
			queue[u][i] = null;	
		}
	}
	
	queue = [];
	running = false;
};

app.listen(process.env.VCAP_APP_PORT || 3000);
