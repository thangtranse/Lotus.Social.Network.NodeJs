// libs
const http = require("http");
const express = require("express");
const fs = require("fs");
const url = require("url");
const bodyParser = require("body-parser");
const AWS = require('aws-sdk');
const uuidv4 = require('uuid/v4');

var app = express();
var formidable = require('formidable');

var session = require('express-session');
var sys_username;
var uploadFile = require('./uploadFile');
var listImage = require('./image/listImage');
// var multer = require('multer');
//
AWS.events.on('httpError', function () {
    if (this.response.error && this.response.error.code === 'UnknownEndpoint') {
        this.response.error.retryable = true;
    }
});
AWS.config.update({region: 'ap-southeast-1'});

app.use("/public/", express.static("../public/"));
app.use("/public/js/", express.static("../node_modules/angular/"));
app.use("/public/js/", express.static("../node_modules/jquery/dist/"));
app.use("/public/css/", express.static("../node_modules/bootstrap/dist/css/"));
app.use("/public/js/", express.static("../node_modules/bootstrap/dist/js/"));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(session({
    secret: uuidv4(),
    resave: true,
    saveUninitialized: true
}));

var auth = function (req, res, next) {
    if (req.session && req.session.user === sys_username && req.session.admin) {
        return next();
    } else {
        return res.redirect('/');
    }
};

// create server
http.createServer(app).listen(9091);
app.get("/", function (req, res) {
    fs.readFile("../views/index.html", function (err, data) {
        if (err) {
            res.writeHead(404, {"content-type": "text/html"});
            res.end("not found");
        } else {
            res.writeHead(200, {"content-type": "text/html"});
            res.write(data);
            res.end();
        }
    });
});

app.get("/home", auth, function (req, res) {
    fs.readFile("../views/newfeed.html", function (err, data) {
        if (err) {
            res.writeHead(404, {"content-type": "text/html"});
            res.end("not found");
        } else {
            res.writeHead(200, {"content-type": "text/html"});
            res.write(data);
            res.end();
        }
    });
});

app.get("/profile", auth, function (req, res) {
    var parse = url.parse(req.url, true);
    console.log("parse", parse);
    if (parse.search == '') {
        callPageProfile(req, res);
    } else {
        var patt = /@/;
        if (typeof (req.query.name) != 'undefined' && patt.test(parse.search)) {
            callPageProfile(req, res);
        } else {
            callPageErr(req, res);
        }
    }
});
app.get("/EditProfile", auth, function (req, res) {

    fs.readFile("../views/editProfile.html", function (err, data) {
        if (err) {
            res.writeHead(404, {"content-type": "text/html"});
            res.end("not found");
        } else {
            console.log("Da vao phan Edit profile");
            res.writeHead(200, {"content-type": "text/html"});
            res.write(data);
            res.end();
        }
    });
});
/**
 * Logout
 */
app.get('/logout', function (req, res) {
    req.session.destroy();
    fs.readFile("../views/index.html", function (err, data) {
        if (err) {
            res.writeHead(404, {"content-type": "text/html"});
            res.end("not found");
        } else {
            res.writeHead(200, {"content-type": "text/html"});
            res.write(data);
            res.end();
        }
    });
});
/**
 * Thông báo lỗi
 */
app.get("/err", auth, function (req, res) {
    callPageErr(req, res);
});

var callPageErr = function (req, res) {
    fs.readFile("../views/error.html", function (err, data) {
        if (err) {
            res.writeHead(404, {"content-type": "text/html"});
            res.end("not found");
        } else {
            res.writeHead(200, {"content-type": "text/html"});
            res.write(data);
            res.end();
        }
    });
}
var callPageProfile = function (req, res) {
    fs.readFile("../views/profile.html", function (err, data) {
        if (err) {
            res.writeHead(404, {"content-type": "text/html"});
            res.end("not found");
        } else {
            res.writeHead(200, {"content-type": "text/html"});
            res.write(data);
            res.end();
        }
    });
}
/**
 * Add User in Collection
 * ------- 2 steps -------
 * 1. check user has existed in collection
 * 2. if user don't exited then add to collection
 * -------input-----------
 * name
 * nickname
 * username
 * password
 * -------output----------
 * 1 if success
 * 0 if fail
 */
app.post("/insertuser", function (req, resp) {
    var obj = {
        id: uuidv4(),
        name: req.body.name,
        nickname: req.body.nickname,
        username: req.body.username,
        password: req.body.password
    };
    if (obj.name.length == 0 || obj.nickname.length == 0 || obj.username.length == 0 || obj.password.length == 0) {
        resp.setHeader('Content-Type', 'application/json');
        resp.send(JSON.stringify({status: false}));
    }
    var dt = require("../application/user/tableUser");
    dt.insertUser(AWS, obj, function (err) {
        console.log("ttt", err);
        if (err) { // đúng
            var dt2 = require("../application/newFeed/newfeed");
            dt2.createTableNewsFeeds(AWS, obj.id, function (err2, data2) {
                if (!err2) {
                    resp.setHeader('Content-Type', 'application/json');
                    resp.send(JSON.stringify({status: true}));
                }
            });
        } else {
            resp.setHeader('Content-Type', 'application/json');
            resp.send(JSON.stringify({status: false}));
        }
    });
});
/**
 * Check is login
 * ------input-----
 * username
 * password
 * ------output----
 * 1 true -> đúng đăng nhập thành công
 * 2 false -> sai đăng nhập thất bại
 *
 */
app.post("/login", function (req, res) {
    var username = req.body.username;
    var password = req.body.password;
    var dt = require("../application/user/tableUser");
    res.setHeader('Content-Type', 'application/json');
    dt.checkLogin(AWS, username, password, function (err, data) {
        if (err) {
            console.log("lỗi", err);
            res.send(JSON.stringify({status: 0}));
        } else {
            console.log(data.Items[0]);
            req.session.allInfor = data.Items[0];
            req.session.user = data.Items[0].username;
            req.session.infoUser = data.Items[0];
            sys_username = data.Items[0].username;
            req.session.admin = true;
            res.send(JSON.stringify({status: 1}));
        }
    });
});

/**
 * Tìm kiếm bạn bè tương đối
 * ---input-----
 * getkey -> username or nickname
 * --output---
 * list username trùng
 */
app.post("/findfriends", function (req, resp) {
    var key = req.body.getkey;
    var dt = require("../application/user/tableUser");
    dt.scanUser(AWS, key, function (err, data) {
        if (!err) {
            resp.setHeader('Content-Type', 'application/json');
            resp.send(JSON.stringify({a: data}));
        }
    });
});
/**
 * Thêm bạn
 */
app.post("/addfriends", function (req, resp) {
    var idf = req.body.id;
    var key = req.body.getkey;
    var nickf = req.body.nickname;
    if (key !== req.session.user) {
        var dt = require("../application/user/tableListFriends");
        dt.insertFriend(AWS, req.session.infoUser._id, idf, key, nickf, getDateTime(), function (err, data) {
            if (!err) {
                resp.setHeader('Content-Type', 'application/json');
                resp.send(JSON.stringify({a: true}));
            }
        });
    }
});
/**
 * Tìm kiếm bạn bè TUYỆT ĐỐI
 * ---input-----
 */
app.post("/findFrieds", auth, function (req, res) {
    var key = req.body.usernametmt;
    var dt = require("../application/user/tableUser");
    if (key !== req.session.infoUser.username) {
        dt.findFrieds(AWS, key, function (err, data) {
            if (!err) {
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify({info: data}));
            } else {
                callPageErr(req, res);
            }
        });
    } else {
        res.setHeader('Content-Type', 'application/json');
        res.end();
    }
});
/**
 * Lấy danh sách bạn bè
 * --output---
 * Json danh sách bạn bè
 */
app.post("/getListFriends", auth, function (req, res) {
    var dt = require("../application/user/tableListFriends");
    dt.getListFriends(AWS, req.session.infoUser._id, function (err, data) {
        if (!err) {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({listFriends: data}));
        }
    })
});
/**
 * Kiểm tra bạn bè
 * --output---
 * True/False
 */
app.post("/checkFriends", auth, function (req, res) {
    console.log("call this");
    var key = req.body.username;
    var dt = require("../application/user/tableListFriends");
    dt.checkFriend(AWS, req.session.infoUser._id, key, function (err, data) {
        if (!err) {
            res.setHeader('Content-Type', 'application/json');
            if (data.Count > 0)
                res.send(JSON.stringify({listFriends: true}));
            else
                res.send(JSON.stringify({listFriends: false}));
        }
    })
});

app.post("/EditProfile", auth, function (req, res) {
    var _username = req.session.infoUser.username;
    var _password = req.session.infoUser.password;
    var _phone = req.body.phone;
    var _address = req.body.address;
    var year = req.body.birth.substring(0, 4);
    var month = req.body.birth.substring(5, 7);
    var ngay = parseInt(req.body.birth.substring(8, 10)) + 1;
    var birthday = ngay + "-" + month + "-" + year;
    var _accountGG = req.body.google;
    var _accountFb = req.body.facebook;
    var _image = null;
    var dt = require("../application/user/tableUser");
    dt.updateUser(AWS, _username, _password, _phone, birthday, _image, _accountFb, _accountGG, _address, function (err, data) {
        if (!err) {
            if (typeof (req.session.allInfor.address) != "undefined") {
                req.session.allInfor.address = _address;
                req.session.infoUser.address = _address;
            } else {
                req.session.allInfor.push({address: _address});
                req.session.infoUser.push({address: _address});
            }
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({user: data}));
        }
        else {
            req.session.allInfor.accountFacebook = _accountFb;
            req.session.allInfor.accountGoogle = _accountGG;
            req.session.allInfor.birthday = birthday;
            req.session.allInfor.phone = _phone;
        }
        ;
    })
})
/**
 * Lấy danh sách các tin tức CỦA MÌNH đã đăng
 */
app.post("/getNewsFeeds", auth, function (req, res) {
    var dt = require("../application/newFeed/newfeed");
    dt.getListNewFeed(AWS, req.session.infoUser._id, function (err, data) {
        if (err == null) {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({listNews: data.Items}));
        }
    });
});

/**
 * Lấy danh sách các tin tức CỦA ID đã đăng
 */
app.post("/getYourNewsFeeds", auth, function (req, res) {
    var key = req.body.usernametmt;
    var dt = require("../application/newFeed/newfeed");
    dt.getListNewFeed(AWS, key, function (err, data) {
        if (err == null) {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({listNews: data.Items}));
        }
    });
});
/**
 * Lấy thông tin người đang đăng nhập
 */
app.post("/getinfo", auth, function (req, res) {
    console.log("oke ", req.session.infoUser);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({user: req.session.infoUser}));
});
/**
 * Lưu tin tức người dùng đăng tải
 * ---input----
 * file -> image
 * context -> nội dung
 */

app.post("/getImage", auth, function (req, res) {
    var dt = require("../application/image/s3_listbuckets");
    var dt2 = require("../application/newFeed/newfeed");
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
        if (files.getImage.size > 0) {
            dt.putItem(AWS, fs, files.getImage, function (data) {
                dt2.insertNew(
                    AWS,
                    req.session.allInfor._id,
                    uuidv4(),
                    req.session.allInfor.username,
                    data.url,
                    (fields.message.length > 0) ? fields.message : 'null',
                    getDateTime(),
                    function (err1, data1) {
                        if (!err1) {
                            fs.readFile("../views/profile.html", function (err, data) {
                                if (err) {
                                    res.writeHead(404, {"content-type": "text/html"});
                                    res.end("not found");
                                } else {
                                    res.writeHead(200, {"content-type": "text/html"});
                                    res.write(data);
                                    res.end();
                                }
                            });
                        } else {
                            fs.readFile("../views/error.html", function (err, data) {
                                if (err) {
                                    res.writeHead(404, {"content-type": "text/html"});
                                    res.end("not found");
                                } else {
                                    res.writeHead(200, {"content-type": "text/html"});
                                    res.write(data);
                                    res.end();
                                }
                            });
                        }
                    });
            });
        } else if (fields.message.length > 0) {
            dt2.insertNew(
                AWS,
                req.session.allInfor._id,
                uuidv4(),
                req.session.allInfor.username,
                'null',
                fields.message,
                getDateTime(),
                function (err1, data1) {
                    if (!err1) {
                        fs.readFile("../views/profile.html", function (err, data) {
                            if (err) {
                                res.writeHead(404, {"content-type": "text/html"});
                                res.end("not found");
                            } else {
                                res.writeHead(200, {"content-type": "text/html"});
                                res.write(data);
                                res.end();
                            }
                        });
                    } else {
                        fs.readFile("../views/error.html", function (err, data) {
                            if (err) {
                                res.writeHead(404, {"content-type": "text/html"});
                                res.end("not found");
                            } else {
                                res.writeHead(200, {"content-type": "text/html"});
                                res.write(data);
                                res.end();
                            }
                        });
                    }
                });
        }
    });
});
/**
 * Lấy ngày tháng hiện tại
 * @return {string}
 */
var getDateTime = function () {
    var date = new Date();
    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;
    var min = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;
    var sec = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;
    var day = date.getDate();
    day = (day < 10 ? "0" : "") + day;
    return year + ":" + month + ":" + day + "-" + hour + ":" + min + ":" + sec;
}

/**
 * system
 * */
var system_tmt = require('../application/system');
system_tmt.init(app, fs, AWS);