const express = require('express');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const app = express();
const path = require('path');
const cuid = require('cuid');
const { GraphQLClient } = require("graphql-request");
const cors = require('cors');
const axios = require('axios');

require("dotenv").config();

//
// ─── USE FILE UPLOAD ────────────────────────────────────────────────────────────
//
app.use(bodyParser());
app.use(fileUpload());
app.use(cors());

//
// ─── PUBLIC FOLDER ──────────────────────────────────────────────────────────────
//
app.use("/uploads", express.static("uploads"))

//
// ─── CONFIGURE PORT ─────────────────────────────────────────────────────────────
//
const PORT = 3333;

//
// ─── GRAPHQL CLIENT ─────────────────────────────────────────────────────────────
//
const endpoint = "http://localhost:8080/v1/graphql";

const client = new GraphQLClient(endpoint, {
	headers: {
		"x-hasura-admin-secret": process.env.ADMIN_SECRET,
	},
});

//
// ─── LISTEN /IMAGE ──────────────────────────────────────────────────────────────
//
app.post('/image', (req, res) => {
	//
	// ─── GET WORK ID ────────────────────────────────────────────────────────────────
	//
	const id = req.body.id || req.params.id || req.query.id;

	//
	// ─── IF IT IS IMAGE FILE ────────────────────────────────────────────────────────
	//
	if (isImageFile(req.files.file)) {
		//
		// ─── STORE FILE ─────────────────────────────────────────────────────────────────
		//
		storeFile(req, res, (path) => {
			//
			// ─── STORE FILE ─────────────────────────────────────────────────────────────────
			//
			client.request(`
				mutation ImageDataNew (
					$workId: uuid!
					$fileUrl: String!
				) {
					insert_image_datas(
						objects: {
							workId: $workId,
							fileUrl: $fileUrl
						}
					) {
						returning {
							fileUrl
						}
					}
				}
			`, {
				workId: id,
				fileUrl: path,
			}).then(data =>
				res.send({
					...data.insert_image_datas.returning
				})
			)
		});
	} else {
		res.sendStatus(403)
	}
});

//
// ─── LISTEN AUDIO ───────────────────────────────────────────────────────────────
//
app.post('/audio', (req, res) => {
	//
	// ─── GET WORK ID ────────────────────────────────────────────────────────────────
	//
	const id = req.body.id || req.params.id || req.query.id;

	//
	// ─── IF IT IS IMAGE FILE ────────────────────────────────────────────────────────
	//
	if (isAudioFile(req.files.file)) {
		//
		// ─── STORE FILE ─────────────────────────────────────────────────────────────────
		//
		storeFile(req, res, (path) => {
			//
			// ─── STORE FILE ─────────────────────────────────────────────────────────────────
			//
			client.request(`
				mutation AudioDataNew (
					$workId: uuid!
					$fileUrl: String!
				) {
					insert_audio_datas(
						objects: {
							workId: $workId,
							fileUrl: $fileUrl
						}
					) {
						returning {
							fileUrl
						}
					}
				}
			`, {
				workId: id,
				fileUrl: path,
			}).then(data =>
				res.send({
					...data.insert_audio_datas.returning
				})
			)
		});
	} else {
		res.sendStatus(403)
	}
});

//
// ─── LISTEN PROGRESS ────────────────────────────────────────────────────────────
//
app.post('/progress', (req, res) => {
	//
	// ─── GET USER ID ────────────────────────────────────────────────────────────────
	//
	const userId = req.body.userId || req.params.userId || req.query.userId;

	//
	// ─── GET WORK ID ────────────────────────────────────────────────────────────────
	//
	const workId = req.body.workId || req.params.workId || req.query.workId;

	//
	// ─── IF IT IS IMAGE FILE ────────────────────────────────────────────────────────
	//
	if (isVideoFile(req.files.file)) {
		client.request(`
				query ProgressCondition(
					$workId: uuid!
				) {
					works_by_pk (
						id: $workId
					) {
						image_datas_aggregate {
							aggregate {
								count
							}
						}

						voice_datas_aggregate {
							aggregate {
								count
							}
						}
					}
				}
			`, {
			workId
		}).then((data) => {
			if (data.works_by_pk.image_datas_aggregate.aggregate.count > 0 && data.works_by_pk.voice_datas_aggregate.aggregate.count > 0) {
				//
				// ─── STORE FILE ─────────────────────────────────────────────────────────────────
				//
				storeFile(req, res, (path) => {
					//
					// CREATE NEW PROGRESS
					//
					client.request(`
						mutation ProgressNew (
							$userId: String!
							$workId: uuid!
							$drivingVideoUrl: String!
						) {
							insert_progresses (
								objects: {
									userId: $userId,
									workId: $workId,
									drivingVideoUrl: $drivingVideoUrl
								}
							) {
								returning {
									drivingVideoUrl
								}
							}
						}
					`, {
						userId,
						workId,
						drivingVideoUrl: path
					}).then(data => {

						res.send({
							...data.insert_progresses.returning
						});

						axios.post(process.env.SYNTHESIZER_ENDPOINT)
							.then(() => {
								console.log("successfully sent a synthesization request.")
							}).catch((e) => {
								console.log("unable to send a synthesization request.")
							});
					});
				});
			} else {
				res.sendStatus(403);
			}
		});
	} else {
		res.sendStatus(403)
	}
});

//
// ─── LISTEN RESULT ──────────────────────────────────────────────────────────────
//
app.post('/result', (req, res) => {
	//
	// ─── GET WORK ID ────────────────────────────────────────────────────────────────
	//
	const id = req.body.id || req.params.id || req.query.id;

	//
	// ─── IF IT IS IMAGE FILE ────────────────────────────────────────────────────────
	//
	if (isVideoFile(req.files.file)) {
		//
		// ─── STORE FILE ─────────────────────────────────────────────────────────────────
		//
		storeFile(req, res, (path) => {
			//
			// ─── STORE FILE ─────────────────────────────────────────────────────────────────
			//
			client.request(`
				mutation ProgressEdit (
					$id: uuid!
					$resultUrl: String!
				) {
					update_progresses (
						where: {
							id: {
								_eq: $id
							}
						}
						_set: {
							resultUrl: $resultUrl
						}
					) {
						affected_rows
					}
				}
			`, {
				id,
				resultUrl: path
			}).then(data =>
				res.send({
					...data.insert_progresses
				})
			)
		});
	} else {
		res.sendStatus(403)
	}
});

const isImageFile = (file) => file && [
	"image/png",
	"image/jpeg",
	"image/jpg",
].includes(file.mimetype);


const isAudioFile = (file) => file && [
	"audio/mpeg",
].includes(file.mimetype);


const isVideoFile = (file) => file && [
	"video/mp4",
].includes(file.mimetype);


const storeFile = (req, res, callback) => {
	//
	// ─── IF NOT FILE WAS FOUND ──────────────────────────────────────────────────────
	//
	if (!req.files || Object.keys(req.files).length === 0) {
		return res.status(400).send({
			error: "No files were uploaded.",
		});
	}

	//
	// ─── GET FILE ───────────────────────────────────────────────────────────────────
	//
	const file = req.files.file;

	//
	// ─── GENERATE FILE PATH ─────────────────────────────────────────────────────────
	//
	const uploadPath = `uploads/${cuid()}${path.extname(file.name)}`;

	//
	// ─── MOVE FILE ──────────────────────────────────────────────────────────────────
	//
	file.mv(uploadPath, function (err) {
		if (err) {
			return res.status(500).send({
				error: "An error occurred at storing file, please try again later."
			});
		}
		callback(uploadPath);
	});
}

//
// ─── START SERVER ───────────────────────────────────────────────────────────────
//
app.listen(PORT, "0.0.0.0", () => {
	console.log(`Express server listening on port ${PORT}.`);
})
