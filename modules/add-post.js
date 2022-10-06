module.exports = {

    database: null,
    functions: null,
    fileSystem: null,
    requestModule: null,
    filter: null,
    ObjectId: null,

    request: null,
    result: null,

    image: "",
    video: "",
    audio: "",
    document: "",
    savedPaths: [],
    type: "",
    user: null,
    _id: null,
    mainURL: "",

    callbackFileUpload: function(files, index, savedPaths = [], success = null) {
        const self = this

        if (files.length > index) {

            this.fileSystem.readFile(files[index].path, function (error, data) {
                if (error) {
                    console.error(error)
                    return
                }

                const filePath = "uploads/" + new Date().getTime() + "-" + files[index].name
                const base64 = new Buffer(data).toString('base64')

                if (files[index].size > 0 && files[index].type.includes("image")) {
                    self.requestModule.post("http://127.0.0.1:8888/scripts/social-networking-site/class.ImageFilter.php", {
                        formData: {
                            "validate_image": 1,
                            "base_64": base64
                        }
                    }, function(err, res, body) {
                        if (!err && res.statusCode === 200) {
                            // console.log(body);

                            if (body > 60) {
                                self.result.json({
                                    "status": "error",
                                    "message": "Image contains nudity."
                                });

                                return false;
                            } else {
                                self.fileSystem.writeFile(filePath, data, async function (error) {
                                    if (error) {
                                        console.error(error)
                                        return
                                    }

                                    savedPaths.push(filePath)

                                    if (index == (files.length - 1)) {
                                        success(savedPaths)
                                    } else {
                                        index++
                                        self.callbackFileUpload(files, index, savedPaths, success)
                                    }
                                })

                                self.fileSystem.unlink(files[index].path, function (error) {
                                    if (error) {
                                        console.error(error)
                                        return
                                    }
                                })
                            }
                        }
                    })
                } else {
                    self.fileSystem.writeFile(filePath, data, async function (error) {
                        if (error) {
                            console.error(error)
                            return
                        }

                        savedPaths.push(filePath)

                        if (index == (files.length - 1)) {
                            success(savedPaths)
                        } else {
                            index++
                            self.callbackFileUpload(files, index, savedPaths, success)
                        }
                    })

                    self.fileSystem.unlink(files[index].path, function (error) {
                        if (error) {
                            console.error(error)
                            return
                        }
                    })
                }
            })
        } else {
            success(savedPaths)
        }
    },

    execute: async function (request, result) {
        var accessToken = request.fields.accessToken;
        var caption = request.fields.caption;
        var image = "";
        var video = "";
        var type = request.fields.type;
        var createdAt = new Date().getTime();
        var base64 = request.fields.imgData;

        this.image = ""
        this.video = ""
        this.audio = ""
        this.document = ""
        this.savedPaths = []

        var self = this;

        this.type = type;
        this.request = request;
        this.result = result;

        /* in case of post in page or group */
        var _id = request.fields._id;
        this._id = _id;

        var user = await this.database.collection("users").findOne({
            "accessToken": accessToken
        });

        if (user == null) {
            result.json({
                "status": "error",
                "message": "User has been logged out. Please login again."
            });

            return false;
        }

        if (user.isBanned) {
            result.json({
                "status": "error",
                "message": "You have been banned."
            });
            return false;
        }

        if (this.filter.isProfane(caption)) {
            result.json({
                "status": "error",
                "message": "Your message contains abusive or offensive language."
            });

            return false;
        }

        this.user = user;

        const files = []
        if (Array.isArray(request.files.files)) {
            for (let a = 0; a < request.files.files.length; a++) {
                files.push(request.files.files[a])
            }
        } else {
            files.push(request.files.files)
        }

        this.callbackFileUpload(files, 0, [], async function (savedPaths) {
            // console.log({
            //     savedPaths: savedPaths
            // })

            self.savedPaths = savedPaths
            self.fileUpload_moveForward()
        })

        return

        /*if (request.files.image.size > 0 && request.files.image.type.includes("image")) {
            image = "public/images/" + new Date().getTime() + "-" + request.files.image.name;
            this.image = image;

            this.requestModule.post("http://127.0.0.1:8888/scripts/social-networking-site/class.ImageFilter.php", {
                formData: {
                    "validate_image": 1,
                    "base_64": base64
                }
            }, function(err, res, body) {
                if (!err && res.statusCode === 200) {
                    // console.log(body);

                    if (body > 60) {
                        result.json({
                            "status": "error",
                            "message": "Image contains nudity."
                        });

                        return false;
                    } else {
                        self.moveForward();
                    }
                }
            });
        } else {
            self.moveForward();
        }*/
    },

    moveForward: async function () {

        var self = this;

        // Read the file
        if (this.request.files.image.size > 0 && this.request.files.image.type.includes("image")) {
            this.fileSystem.readFile(this.request.files.image.path, function (err, data) {
                if (err) throw err;
                console.log('File read!');

                // Write the file
                self.fileSystem.writeFile(self.image, data, function (err) {
                    if (err) throw err;
                    console.log('File written!');

                    self.fileUpload_moveForward();
                });

                // Delete the file
                self.fileSystem.unlink(self.request.files.image.path, function (err) {
                    if (err) throw err;
                    console.log('File deleted!');
                });
            });
        } else if (this.request.files.video.size > 0 && this.request.files.video.type.includes("video")) {
            this.video = "public/videos/" + new Date().getTime() + "-" + this.request.files.video.name;

            // Read the file
            this.fileSystem.readFile(this.request.files.video.path, function (err, data) {
                if (err) throw err;
                console.log('File read!');

                // Write the file
                self.fileSystem.writeFile(self.video, data, function (err) {
                    if (err) throw err;
                    console.log('File written!');

                    self.fileUpload_moveForward();
                });

                // Delete the file
                self.fileSystem.unlink(self.request.files.video.path, function (err) {
                    if (err) throw err;
                    console.log('File deleted!');
                });
            });
        } else if (this.request.files.audio.size > 0 && this.request.files.audio.type.includes("audio")) {
            this.audio = "public/audios/" + new Date().getTime() + "-" + this.request.files.audio.name;

            // Read the file
            this.fileSystem.readFile(this.request.files.audio.path, function (err, data) {
                if (err) throw err;
                console.log('File read!');

                // Write the file
                self.fileSystem.writeFile(self.audio, data, function (err) {
                    if (err) throw err;
                    console.log('File written!');

                    self.fileUpload_moveForward();
                });

                // Delete the file
                self.fileSystem.unlink(self.request.files.audio.path, function (err) {
                    if (err) throw err;
                    console.log('File deleted!');
                });
            });
        } else if (this.request.files.document.size > 0) {
            this.document = "public/documents/" + new Date().getTime() + "-" + this.request.files.document.name;

            // Read the file
            this.fileSystem.readFile(this.request.files.document.path, function (err, data) {
                if (err) throw err;
                console.log('File read!');

                // Write the file
                self.fileSystem.writeFile(self.document, data, function (err) {
                    if (err) throw err;
                    console.log('File written!');

                    self.fileUpload_moveForward();
                });

                // Delete the file
                self.fileSystem.unlink(self.request.files.document.path, function (err) {
                    if (err) throw err;
                    console.log('File deleted!');
                });
            });
        } else {
            this.fileUpload_moveForward();
        }
    },

    fileUpload_moveForward: async function () {
        var _id = this.ObjectId();
        var link = mainURL + "/post/" + _id;

        const youtube_url = this.request.fields.youtube_url

        var postObj = {
            "_id": _id,
            "caption": this.request.fields.caption,
            "image": this.image,
            "video": this.video,
            "audio": this.audio,
            "document": this.document,
            "savedPaths": this.savedPaths,
            "youtube_url": youtube_url,
            "type": this.type,
            "createdAt": new Date().getTime(),
            "likers": [],
            "dislikers": [],
            "comments": [],
            "shares": [],
            "link": link,
            "user": {
                "_id": this.user._id,
                "name": this.user.name,
                "username": this.user.username,
                "profileImage": this.user.profileImage
            }
        };

        if (this.type == "page_post") {

            var page = await this.database.collection("pages").findOne({
                "_id": this.ObjectId(this._id)
            });

            if (page == null) {
                this.result.json({
                    "status": "error",
                    "message": "Page does not exist."
                });
                return false;
            }

            if (page.user._id.toString() != this.user._id.toString()) {
                this.result.json({
                    "status": "error",
                    "message": "Sorry, you do not own this page."
                });
                return;
            }

            postObj = {
                "caption": this.request.fields.caption,
                "image": this.image,
                "video": this.video,
                "audio": this.audio,
                "document": this.document,
                "savedPaths": this.savedPaths,
                "youtube_url": youtube_url,
                "type": this.type,
                "createdAt": new Date().getTime(),
                "likers": [],
                "dislikers": [],
                "comments": [],
                "shares": [],
                "user": {
                    "_id": page._id,
                    "name": page.name,
                    "username": page.name,
                    "profileImage": page.coverPhoto
                }
            };
        } else if (this.type == "group_post") {

            var group = await this.database.collection("groups").findOne({
                "_id": this.ObjectId(this._id)
            });

            if (group == null) {
                this.result.json({
                    "status": "error",
                    "message": "Group does not exist."
                });
                return false;
            }

            var isMember = false;
            for (var a = 0; a < group.members.length; a++) {
                var member = group.members[a];

                if (member._id.toString() == this.user._id.toString() && member.status == "Accepted") {
                    isMember = true;
                    break;
                }
            }

            if (!isMember) {
                this.result.json({
                    "status": "error",
                    "message": "Sorry, you are not a member of this group."
                });
                return false;
            }

            postObj = {
                "caption": this.request.fields.caption,
                "image": this.image,
                "video": this.video,
                "audio": this.audio,
                "document": this.document,
                "savedPaths": this.savedPaths,
                "youtube_url": youtube_url,
                "type": this.type,
                "createdAt": new Date().getTime(),
                "likers": [],
                "dislikers": [],
                "comments": [],
                "shares": [],
                "user": {
                    "_id": group._id,
                    "name": group.name,
                    "username": group.name,
                    "profileImage": group.coverPhoto
                },
                "uploader": {
                    "_id": this.user._id,
                    "name": this.user.name,
                    "username": this.user.username,
                    "profileImage": this.user.profileImage
                }
            };
        }

        await this.database.collection("posts").insertOne(postObj);

        this.result.json({
            "status": "success",
            "message": "Post has been uploaded.",
            "postObj": postObj
        });

        return true;
    }
};