
/**
 * Module dependencies.
 */

var express = require('express');
var http = require('http');
var path = require('path');
var moment = require('moment');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('devhub', process.env.DEVHUB);
app.set('memo_no', process.env.NO);
app.set('memo_line', process.env.LINE);
app.set('server_host', process.env.SERVER_HOST);
app.set('avatar_url', "http://" + app.get("server_host") + ":" + app.get("port"));
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));
app.use(app.router);

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

function postData(name, msg, avatar){
	var url = app.get('devhub') + "/notify?name=" + escape(name) + "&msg=" + escape(msg);
  if (avatar != undefined){
     url = url + "&avatar=" + escape(avatar);
  }

  var urlObj = require("url").parse(url);
  var getOption = {
      "hostname"  : urlObj.hostname,
      "port"  : urlObj.port,
      "path"  : urlObj.path
  };
  if (process.env.NODE_DEVHUB_USER && process.env.NODE_DEVHUB_PASS){
    getOption.auth = process.env.NODE_DEVHUB_USER + ":" + process.env.NODE_DEVHUB_PASS;
  }

	http.get(getOption);
}

function postDataToMemo(name, msg){
	if (!(app.get('memo_no') && app.get('memo_line'))){ return; }

	no = app.get('memo_no');
	line = app.get('memo_line');

	var url = app.get('devhub') + "/memo?name=" + escape(name) + "&msg=" + escape(msg) + "&no=" + no + "&line=" + line;

  var urlObj = require("url").parse(url);
  var getOption = {
      "hostname"  : urlObj.hostname,
      "port"  : urlObj.port,
      "path"  : urlObj.path
  };
  if (process.env.NODE_DEVHUB_USER && process.env.NODE_DEVHUB_PASS){
      getOption.auth = process.env.NODE_DEVHUB_USER + ":" + process.env.NODE_DEVHUB_PASS;
  }

  http.get(getOption, function(){});
}

function postPushNotification(name, payload, avatar){
	var pusher = payload["pusher"]["name"];
	var branch = payload["ref"].match(/refs\/heads\/(.+)/)[1];
	var commits = payload["commits"];
	var repo = payload["repository"]["name"];
	var url = payload["repository"]["url"];

	// for chat
	var commit_comments = [];
	commits.forEach(function(value){
		commit_comments.push("<br> - [" + value["message"].split("\n")[0] + "](" + value["url"] + ")");
	});

	var msg = ":arrow_up: " + pusher + " pushes to [" + repo + " (" + branch + ")]("+ url + ")" + commit_comments.join(" ");
	postData(name, msg, avatar);

	// for memo
	commit_comments = [];
	commits.forEach(function(value){
		commit_comments.push("<br>                 |  - [" + value["message"].split("\n")[0] + "](" + value["url"] + ")");
	});

	var now = moment().format("YYYY/MM/DD HH:mm");
	var memo_msg = now + " | [" + repo + " (" + branch + ")](" + url + ") by " + pusher + commit_comments.join(" ");
	postDataToMemo(name, memo_msg);
}

function postPullRequestNotification(name, payload, avatar){
	var user = payload["sender"]["login"];
	var title = payload["pull_request"]["title"];
	var url = payload["pull_request"]["html_url"];
  var repo = payload["repository"]["name"];
  var repo_url = payload["repository"]["html_url"];

	var msg = ":seedling: " + user + " opened pull request to [" + repo + "](" + repo_url + ").<br> - [" + title + "](" + url + ")";
	postData(name, msg, avatar);
}

function postPullRequestCommentNotification(name, payload, avatar){
	var user = payload["sender"]["login"];
	var title = payload["issue"]["title"];
	var url = payload["comment"]["html_url"];
  var repo = payload["repository"]["name"];
  var repo_url = payload["repository"]["html_url"];

	var msg = ":speech_balloon: " + user + " commented to pull request at [" + repo + "](" + repo_url + ").<br> - [" + title + "](" + url + ")";
	postData(name, msg, avatar);
}

function postIssueNotification(name, payload, avatar){
	var user = payload["sender"]["login"];
	var title = payload["issue"]["title"];
	var url = payload["issue"]["html_url"];
  var repo = payload["repository"]["name"];
  var repo_url = payload["repository"]["html_url"];

	var msg = ":warning: " + user + " opened issue to [" + repo + "](" + repo_url + ").<br> - [" + title + "](" + url + ")";
	postData(name, msg, avatar);
}

function postIssueCommentNotification(name, payload, avatar){
	var user = payload["sender"]["login"];
	var title = payload["issue"]["title"];
	var url = payload["issue"]["html_url"];
  var repo = payload["repository"]["name"];
  var repo_url = payload["repository"]["html_url"];

	var msg = ":speech_balloon: " + user + " commented to issue at [" + repo + "](" + repo_url + ").<br> - [" + title + "](" + url + ")";
	postData(name, msg, avatar);
}

app.post('/gitlab', function(req, res){
	var data = req.body;
	var msg = data.user_name + " pushes to [" + data.repository.name + "](" + data.repository.homepage + ")" ;
	postData("gitlab", msg);
	res.json({});
});

app.post('/redmine', function(req, res){
	var data = req.body;
	var action = data.payload.action;
	var author = data.payload.issue.author.login;
	var subject = data.payload.issue.subject;
	var url = data.payload.url;
	var msg = author + " " + action + " [" + subject + "]("+ url + ")";
 	postData("redmine", msg, app.get("avatar_url") + "/redmine.png");
	res.json({});
});

app.post('/gitbucket', function(req, res){
	var data = req.body;
	var payload = JSON.parse(data.payload);

  if (payload["pusher"] != null){
    postPushNotification("gitbucket", payload, app.get("avatar_url") + "/gitbucket.png");
  }else if (payload["pull_request"] != null){
    postPullRequestNotification("gitbucket", payload, app.get("avatar_url") + "/gitbucket.png");
  }else if (payload["issue"] != null && payload["issue"]["pull_request"] != null){
    postPullRequestCommentNotification("gitbucket", payload, app.get("avatar_url") + "/gitbucket.png");
  }else if (payload["issue"] != null && payload["issue"]["pull_request"] == null && payload["comment"] == null){
    postIssueNotification("gitbucket", payload, app.get("avatar_url") + "/gitbucket.png");
  }else if (payload["issue"] != null && payload["issue"]["pull_request"] == null && payload["comment"] != null){
    postIssueCommentNotification("gitbucket", payload, app.get("avatar_url") + "/gitbucket.png");
  }else{
    console.log(payload);
  }

	res.json({});
});

app.post('/github', function(req, res){
	var payload = req.body;

	// for ping
	if (payload["zen"]){
		res.json({});
		return;
	}

	postPushNotification("github", payload, app.get("avatar_url") + "/github.png");
	res.json({});
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
