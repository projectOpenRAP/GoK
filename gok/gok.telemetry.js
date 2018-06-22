'use stict'

const fs = require('fs');
const zip = new require('node-zip')();
const cron = require('node-cron');
const request = require('request');
const q = require('q');

const {
	isInternetActive,
    getTelemetryData,
	zipContents
} = require('../../../telemetrysdk');

const plugin = 'gok';
const telemetryPath = '/home/genghiskh/tmp/telemetry';

let sendTelemetry = ({ fullPath, fullName, buffer }) => {
	const url = 'http://35.187.232.200:8888/api/auth/v1/telemetry/couchbase';
	const formData = {
		file : fs.createReadStream(fullPath)
	};

	request.post({ url, formData }, (err, httpRes, body) => {
		if(err) {
			console.log(err);
			throw err;
		} else {
			console.log('Telemetry sent. Response:', body);
		}
	});
}

let initiateTelemetrySync = () => {
	console.log('Initiated telemetry sync.');

    cron.schedule('*/30 * * * * *', () => {
        isInternetActive()
            .then(() => getTelemetryData(plugin, 1))
            .then(res => {
				if(res.success) {
					const data = zipContents(plugin, res.data);
					return sendTelemetry(data)
				} else {
					throw res.msg;
				}
			})
            .catch(error => {
                console.log('Telemetry not synced.');
                console.log(error);
            });
    });
}

module.exports = {
	initiateTelemetrySync
}
