var express = require("express");
var app = express();

var formidable = require("express-formidable");
app.use(formidable({
    multiples: true, // request.files to be arrays of files
}));

var mongodb = require("mongodb");
var mongoClient = mongodb.MongoClient;
var ObjectId = mongodb.ObjectId;

var http = require("http").createServer(app);
var bcrypt = require("bcrypt");
var fileSystem = require("fs");

var nodemailer = require("nodemailer");
var requestModule = require('request');

var functions = require("./modules/functions");
var chat = require("./modules/chat");
var page = require("./modules/page");
var group = require("./modules/group");
var addPost = require("./modules/add-post");
var editPost = require("./modules/edit-post");

var jwt = require("jsonwebtoken");
var accessTokenSecret = "myAccessTokenSecret1234567890";

const Cryptr = require("cryptr");
const cryptr = new Cryptr("mySecretKey");

const Filter = require("bad-words");
const filter = new Filter();

const cron = require("node-cron");
const moment = require('moment-timezone')

var admin = require("./modules/admin");
admin.init(app, express);

app.use("/public", express.static(__dirname + "/public"))
app.use("/uploads", express.static(__dirname + "/uploads"))
app.use("/audios", express.static(__dirname + "/audios"))
app.use("/documents", express.static(__dirname + "/documents"))
app.set("view engine", "ejs")

var socketIO = require("socket.io")(http);
var socketID = "";
var users = [];

var mainURL = "http://localhost:3000";

var nodemailerFrom = "fashionconnectca@gmail.com";
var nodemailerObject = {
	service: "gmail",
	host: 'smtp.gmail.com',
    port: 465,
    secure: true,
	auth: {
		user: "fashionconnectca@gmail.com",
		pass: "fashion@canada"
	}
};

socketIO.on("connection", function (socket) {
	// console.log("User connected", socket.id);
	socketID = socket.id;
});

function getUTCToTZInFormat(eventDateTimeUTC) {
	const userTZEventDate = eventDateTimeUTC.split("T").join(" ").slice(0, -1)
	let date = moment.utc(userTZEventDate).tz(moment.tz.guess()).format()
	date = date.split("+")[0]
	return date
}

http.listen(3000, function () {
	console.log("Server started at " + mainURL);

	mongoClient.connect("mongodb://localhost:27017", {
		useUnifiedTopology: true
	}, async function (error, client) {
		var database = client.db("my_social_network");
		console.log("Database connected.");

		functions.database = database;
		functions.fileSystem = fileSystem;

		chat.database = database;
		chat.socketIO = socketIO;
		chat.users = users;
		chat.ObjectId = ObjectId;
		chat.fileSystem = fileSystem;
		chat.cryptr = cryptr;
		chat.filter = filter;

		page.database = database;
		page.ObjectId = ObjectId;
		page.fileSystem = fileSystem;

		group.database = database;
		group.ObjectId = ObjectId;
		group.fileSystem = fileSystem;

		addPost.database = database;
		addPost.functions = functions;
		addPost.fileSystem = fileSystem;
		addPost.requestModule = requestModule;
		addPost.filter = filter;
		addPost.ObjectId = ObjectId;
		addPost.mainURL = mainURL;

		editPost.database = database;
		editPost.functions = functions;
		editPost.fileSystem = fileSystem;
		editPost.requestModule = requestModule;
		editPost.filter = filter;
		editPost.ObjectId = ObjectId;

		admin.database = database;
		admin.bcrypt = bcrypt;
		admin.jwt = jwt;
		admin.ObjectId = ObjectId;
		admin.fileSystem = fileSystem;
		admin.mainURL = mainURL;

		/*cron.schedule("* * * * *", async function () {
			let stories = await database.collection("stories").aggregate([{
				$project: {
					duration: {
						$divide: [{
							$subtract: [new Date().getTime(), "$createdAt"]
						}, 3600000]
					}
				}
			}]).toArray()
			let filterArr = []
			for (let a = 0; a < stories.length; a++) {
				if (stories[a].duration >= 24) {
					filterArr.push(stories[a]._id)
				}
			}

			await database.collection("stories").updateMany({
				"_id": {
					$in: filterArr
				}
			}, {
				$set: {
					"status": "passed"
				}
			})
			console.log("---------------------")
			console.log("Stories ended........")
			console.log(filterArr)
			console.log("---------------------")
		})*/

	

		app.get("/signup", function (request, result) {
			result.render("signup");
		});

		app.get("/forgot-password", function (request, result) {
			result.render("forgot-password");
		});

		app.post("/sendRecoveryLink", function (request, result) {

			var email = request.fields.email;
			
			database.collection("users").findOne({
				"email": email
			}, function (error, user) {
				if (user == null) {
					result.json({
						'status': "error",
						'message': "Email does not exists."
					});
				} else {
					var reset_token = new Date().getTime();
					
					database.collection("users").findOneAndUpdate({
						"email": email
					}, {
						$set: {
							"reset_token": reset_token
						}
					}, function (error, data) {
						
						var transporter = nodemailer.createTransport(nodemailerObject);

						var text = "Please click the following link to reset your password: " + mainURL + "/ResetPassword/" + email + "/" + reset_token;
						var html = "Please click the following link to reset your password: <br><br> <a href='" + mainURL + "/ResetPassword/" + email + "/" + reset_token + "'>Reset Password</a> <br><br> Thank you.";

						transporter.sendMail({
							from: nodemailerFrom,
							to: email,
							subject: "Reset Password",
							text: text,
							html: html
						}, function (error, info) {
							if (error) {
								console.error(error);
							} else {
								console.log("Email sent: " + info.response);
							}
							
							result.json({
								'status': "success",
								'message': 'Email has been sent with the link to recover the password.'
							});
						});
						
					});
				}
			});
		});

		app.get("/ResetPassword/:email/:reset_token", function (request, result) {

			var email = request.params.email;
			var reset_token = request.params.reset_token;

			result.render("reset-password", {
				"email": email,
				"reset_token": reset_token
			});
		});

		app.get("/verifyEmail/:email/:verification_token", function (request, result) {

			var email = request.params.email;
			var verification_token = request.params.verification_token;

			database.collection("users").findOne({
				$and: [{
					"email": email,
				}, {
					"verification_token": parseInt(verification_token)
				}]
			}, function (error, user) {
				if (user == null) {
					result.json({
						'status': "error",
						'message': 'Email does not exists. Or verification link is expired.'
					});
				} else {

					database.collection("users").findOneAndUpdate({
						$and: [{
							"email": email,
						}, {
							"verification_token": parseInt(verification_token)
						}]
					}, {
						$set: {
							"verification_token": "",
							"isVerified": true
						}
					}, function (error, data) {
						result.json({
							'status': "success",
							'message': 'Account has been verified. Please try login.'
						});
					});
				}
			});
		});

		app.post("/ResetPassword", function (request, result) {
		    var email = request.fields.email;
		    var reset_token = request.fields.reset_token;
		    var new_password = request.fields.new_password;
		    var confirm_password = request.fields.confirm_password;

		    if (new_password != confirm_password) {
		    	result.json({
					'status': "error",
					'message': 'Password does not match.'
				});
		        return;
		    }

		    database.collection("users").findOne({
				$and: [{
					"email": email,
				}, {
					"reset_token": parseInt(reset_token)
				}]
			}, function (error, user) {
				if (user == null) {
					result.json({
						'status': "error",
						'message': 'Email does not exists. Or recovery link is expired.'
					});
				} else {

					bcrypt.hash(new_password, 10, function (error, hash) {
						database.collection("users").findOneAndUpdate({
							$and: [{
								"email": email,
							}, {
								"reset_token": parseInt(reset_token)
							}]
						}, {
							$set: {
								"reset_token": "",
								"password": hash
							}
						}, function (error, data) {
							result.json({
								'status': "success",
								'message': 'Password has been changed. Please try login again.'
							});
						});

					});
				}
			});
		});

		app.get("/change-password", function (request, result) {
			result.render("change-password");
		});

		app.post("/changePassword", function (request, result) {
			
			var accessToken = request.fields.accessToken;
			var current_password = request.fields.current_password;
			var new_password = request.fields.new_password;
			var confirm_password = request.fields.confirm_password;

			if (new_password != confirm_password) {
		    	result.json({
					'status': "error",
					'message': 'Password does not match.'
				});
		        return;
		    }

			database.collection("users").findOne({
				"accessToken": accessToken
			}, function (error, user) {
				if (user == null) {
					result.json({
						"status": "error",
						"message": "User has been logged out. Please login again."
					});
				} else {

					if (user.isBanned) {
						result.json({
							"status": "error",
							"message": "You have been banned."
						});
						return false;
					}

					bcrypt.compare(current_password, user.password, function (error, isVerify) {
						if (isVerify) {
							bcrypt.hash(new_password, 10, function (error, hash) {
								database.collection("users").findOneAndUpdate({
									"accessToken": accessToken
								}, {
									$set: {
										"password": hash
									}
								}, function (error, data) {
									result.json({
										"status": "success",
										"message": "Password has been changed"
									});
								});
							});
						} else {
							result.json({
								"status": "error",
								"message": "Current password is not correct"
							});
						}
					});
				}
			});
		});

		app.post("/signup", function (request, result) {
			var firstname = request.fields.firstname;
			var lastname = request.fields.lastname;
			var username = request.fields.username;
			var email = request.fields.email;
			var password = request.fields.password;
			var gender = request.fields.gender;
			var primaryrole = request.fields.primaryrole;
			var reset_token = "";
			var isVerified = true;
			var isBanned = false;
			var verification_token = new Date().getTime();
			verification_token = ""

			database.collection("users").findOne({
				$or: [{
					"email": email
				}, {
					"username": username
				}]
			}, function (error, user) {
				if (user == null) {
					bcrypt.hash(password, 10, function (error, hash) {
						database.collection("users").insertOne({
							"firstname": firstname,
							"lastname":lastname,
							"username": username,
							"email": email,
							"password": hash,
							"gender": gender,
							"primaryrole": primaryrole,
							"reset_token": reset_token,
							"profileImage": "",
							"coverPhoto": "",
							"dob": "",
							"city": "",
							"country": "",
							"aboutMe": "",
							"friends": [],
							"pages": [],
							"notifications": [],
							"groups": [],
							"isVerified": isVerified,
							"verification_token": verification_token,
							"isBanned": isBanned
						}, function (error, data) {

							var transporter = nodemailer.createTransport(nodemailerObject);

							var text = "Please verify your account by click the following link: " + mainURL + "/verifyEmail/" + email + "/" + verification_token;
							var html = "Please verify your account by click the following link: <br><br> <a href='" + mainURL + "/verifyEmail/" + email + "/" + verification_token + "'>Confirm Email</a> <br><br> Thank you.";

							transporter.sendMail({
								from: nodemailerFrom,
								to: email,
								subject: "Email Verification",
								text: text,
								html: html
							}, function (error, info) {
								if (error) {
									console.error(error);
								} else {
									console.log("Email sent: " + info.response);
								}
								
								result.json({
									"status": "success",
									"message1": "Signed up successfully. An email has been sent to verify your account. Once verified, you will be able to login and start using social network.",
									"message": "Signed up successfully. you will be able to login and start using fashion connect."
								});

							});

							/*mongoClient.connect("mongodb://localhost:27017", {
								useUnifiedTopology: true
							}, async function (error, client) {
								var videoDatabase = client.db("youtube");
								console.log("Video streaming database connected.");

								const firstName = name.split(" ").length > 0 ? name.split(" ")[0] : name
								const lastName = name.split(" ").length > 1 ? name.split(" ")[1] : name

								await videoDatabase.collection("users").insertOne({
									"first_name": firstName,
									"last_name": lastName,
									"email": email,
									"password": hash,
									"subscribers": [],
									"reset_token": reset_token,
									"isVerified": isVerified,
									"verification_token": verification_token
								})

								result.json({
									"status": "success",
									"message": "Signed up successfully."
								})
							})*/
							
						});
					});
				} else {
					result.json({
						"status": "error",
						"message": "Email or Username already exist."
					});
				}
			});
		});

		app.get("/login", function (request, result) {
			result.render("login");
		});

		app.post("/login", function (request, result) {
			var email = request.fields.email;
			var password = request.fields.password;
			database.collection("users").findOne({
				"email": email
			}, function (error, user) {
				if (user == null) {
					result.json({
						"status": "error",
						"message": "Email does not exist"
					});
				} else {

					if (user.isBanned) {
						result.json({
							"status": "error",
							"message": "You have been banned."
						});
						return false;
					}

					bcrypt.compare(password, user.password, function (error, isVerify) {
						if (isVerify) {

							if (user.isVerified) {
								var accessToken = jwt.sign({ email: email }, accessTokenSecret);
								database.collection("users").findOneAndUpdate({
									"email": email
								}, {
									$set: {
										"accessToken": accessToken
									}
								}, function (error, data) {
									result.json({
										"status": "success",
										"message": "Login successfully",
										"accessToken": accessToken,
										"profileImage": user.profileImage
									});
								});
							}  else {
								result.json({
									"status": "error",
									"message": "Kindly verify your email."
								});
							}
							
						} else {
							result.json({
								"status": "error",
								"message": "Password is not correct"
							});
						}
					});
				}
			});
		});

		app.get("/user/:username", function (request, result) {
			database.collection("users").findOne({
				"username": request.params.username
			}, function (error, user) {
				if (user == null) {
					result.render("errors/404", {
						"message": "This account does not exists anymore."
					});
				} else {
					result.render("userProfile", {
						"user": user
					});
				}
			});
		});

		app.get("/updateProfile", function (request, result) {
			result.render("updateProfile");
		});

		app.post("/getUser", async function (request, result) {
			var accessToken = request.fields.accessToken;
			
			var user = await database.collection("users").findOne({
				"accessToken": accessToken
			});

			if (user == null) {
				result.json({
					"status": "error",
					"message": "User has been logged out. Please login again."
				});
			} else {

				if (user.isBanned) {
					result.json({
						"status": "error",
						"message": "You have been banned."
					});
					return false;
				}

				user.profileViewers = await database.collection("profile_viewers").find({
					"profile._id": user._id
				}).toArray();

				user.pages = await database.collection("pages").find({
					"user._id": user._id
				}).toArray();

				result.json({
					"status": "success",
					"message": "Record has been fetched.",
					"data": user
				});
			}
		});

		app.get("/logout", function (request, result) {
			result.redirect("/login");
		});

		app.post("/uploadCoverPhoto", function (request, result) {
			var accessToken = request.fields.accessToken;
			var coverPhoto = "";

			database.collection("users").findOne({
				"accessToken": accessToken
			}, function (error, user) {
				if (user == null) {
					result.json({
						"status": "error",
						"message": "User has been logged out. Please login again."
					});
				} else {

					if (user.isBanned) {
						result.json({
							"status": "error",
							"message": "You have been banned."
						});
						return false;
					}

					if (request.files.coverPhoto.size > 0 && request.files.coverPhoto.type.includes("image")) {

						if (user.coverPhoto != "") {
							fileSystem.unlink(user.coverPhoto, function (error) {
								//
							});
						}

						coverPhoto = "public/images/cover-" + new Date().getTime() + "-" + request.files.coverPhoto.name;

						// Read the file
	                    fileSystem.readFile(request.files.coverPhoto.path, function (err, data) {
	                        if (err) throw err;
	                        console.log('File read!');

	                        // Write the file
	                        fileSystem.writeFile(coverPhoto, data, function (err) {
	                            if (err) throw err;
	                            console.log('File written!');

	                            database.collection("users").updateOne({
									"accessToken": accessToken
								}, {
									$set: {
										"coverPhoto": coverPhoto
									}
								}, function (error, data) {
									result.json({
										"status": "status",
										"message": "Cover photo has been updated.",
										data: mainURL + "/" + coverPhoto
									});
								});
	                        });

	                        // Delete the file
	                        fileSystem.unlink(request.files.coverPhoto.path, function (err) {
	                            if (err) throw err;
	                            console.log('File deleted!');
	                        });
	                    });
						
					} else {
						result.json({
							"status": "error",
							"message": "Please select valid image."
						});
					}
				}
			});
		});

		app.post("/uploadProfileImage", function (request, result) {
			var accessToken = request.fields.accessToken;
			var profileImage = "";

			database.collection("users").findOne({
				"accessToken": accessToken
			}, function (error, user) {
				if (user == null) {
					result.json({
						"status": "error",
						"message": "User has been logged out. Please login again."
					});
				} else {

					if (user.isBanned) {
						result.json({
							"status": "error",
							"message": "You have been banned."
						});
						return false;
					}

					if (request.files.profileImage.size > 0 && request.files.profileImage.type.includes("image")) {

						if (user.profileImage != "") {
							fileSystem.unlink(user.profileImage, function (error) {
								// console.log("error deleting file: " + error);
							});
						}

						profileImage = "public/images/profile-" + new Date().getTime() + "-" + request.files.profileImage.name;

						// Read the file
	                    fileSystem.readFile(request.files.profileImage.path, function (err, data) {
	                        if (err) throw err;
	                        console.log('File read!');

	                        // Write the file
	                        fileSystem.writeFile(profileImage, data, function (err) {
	                            if (err) throw err;
	                            console.log('File written!');

	                            database.collection("users").updateOne({
									"accessToken": accessToken
								}, {
									$set: {
										"profileImage": profileImage
									}
								}, async function (error, data) {

									await functions.updateUser(user, profileImage, user.name);

									result.json({
										"status": "status",
										"message": "Profile image has been updated.",
										data: mainURL + "/" + profileImage
									});
								});
	                        });

	                        // Delete the file
	                        fileSystem.unlink(request.files.profileImage.path, function (err) {
	                            if (err) throw err;
	                            console.log('File deleted!');
	                        });
	                    });

					} else {
						result.json({
							"status": "error",
							"message": "Please select valid image."
						});
					}
				}
			});
		});

		app.post("/updateProfile", function (request, result) {
			var accessToken = request.fields.accessToken;
			var name = request.fields.name;
			var dob = request.fields.dob;
			var city = request.fields.city;
			var country = request.fields.country;
			var aboutMe = request.fields.aboutMe;

			database.collection("users").findOne({
				"accessToken": accessToken
			}, function (error, user) {
				if (user == null) {
					result.json({
						"status": "error",
						"message": "User has been logged out. Please login again."
					});
				} else {

					if (user.isBanned) {
						result.json({
							"status": "error",
							"message": "You have been banned."
						});
						return false;
					}

					database.collection("users").updateOne({
						"accessToken": accessToken
					}, {
						$set: {
							"name": name,
							"dob": dob,
							"city": city,
							"country": country,
							"aboutMe": aboutMe
						}
					}, async function (error, data) {

						await functions.updateUser(user, user.profileImage, name);

						result.json({
							"status": "status",
							"message": "Profile has been updated."
						});
					});
				}
			});
		});

	

		app.get("/", function (request, result) {
			result.render("index")
		})

		

       

        app.get("/profileViews", function (request, result) {
        	result.render("profileViews");
        });




		app.post("/connectSocket", function (request, result) {
			var accessToken = request.fields.accessToken;
			database.collection("users").findOne({
				"accessToken": accessToken
			}, function (error, user) {
				if (user == null) {
					result.json({
						"status": "error",
						"message": "User has been logged out. Please login again."
					});
				} else {

					if (user.isBanned) {
						result.json({
							"status": "error",
							"message": "You have been banned."
						});
						return false;
					}

					users[user._id] = socketID;
					result.json({
						"status": "status",
						"message": "Socket has been connected."
					});
				}
			});
		});

		app.get("/createPage", function (request, result) {
			result.render("createPage");
		});



	});
});