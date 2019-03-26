'use strict'

const uniqid = require('uniqid');
const fs = require('fs');
const path = require('path');
const q = require('q');
const prc = require('process');

const { selectFields } = require('dbsdk');
const { saveTelemetry } = require('/opt/opencdn/telemetrysdk');

// Generic telemetry JSON structure
const telemetryStructure = {
	'eid': '', // Event ID
	'ets': '', // Event timestamp
	'ver': '', // Structure version
	'mid': '', // Message ID
	'actor': {
		'id': '', // ID of the entity causing the event
		'type': '' // Type of entity
	},
	'context': {
		'channel': '', // Where event occurred
		'pdata': {
			'id': '', // Device ID
			'pid': '', // Process ID
			'ver': '' // Version of the firmware
		},
		'env': '', // Event environment
		'sid': '', // Optional
		'did': '', // Optional
		'cdata': [{ // Optional
			'type':'',
			'id': ''
		}],
		'rollup': { // Optional
			'l1': '',
			'l2': '',
			'l3': '',
			'l4': ''
		}
	},
	'object': { // Optional
		'id': '',
		'type': '',
		'ver': '',
		'rollup': {
			'l1': '',
			'l2': '',
			'l3': '',
			'l4': ''
		}
	},
	'edata': { // Event spcific data
		'event': '',
		'value': '',
		'actor': '',
		'actorDetails': ''
	},
	'tags': ['']
}

const _formatTimestamp = timestamp => {
	const padWithZeroes = number => number < 10 ? '0' + number.toString() : number.toString();

	const date = [
		timestamp.getFullYear().toString(),
		padWithZeroes(timestamp.getMonth()+1),
		padWithZeroes(timestamp.getDate())
	].join('-');

	const time = [
		padWithZeroes(timestamp.getHours()),
		padWithZeroes(timestamp.getMinutes()),
		padWithZeroes(timestamp.getSeconds())
	].join(':');

    return `${date} ${time}`;
}

const _formatBytes = (bytes, decimals) => {
	if(bytes === 0) return '0 Bytes';
	const k = 1024,
		dm = decimals || 2,
		sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
		i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const _getUaspecObject = (headers) => {
	const userAgent = headers['user-agent'];
	const userAgentParts = userAgent
							.split(/(\(|\))/)
							.filter(item => item !== '(' && item !== ')')
							.map(item => item.trim())

	return {
		'agent': userAgentParts[0].split('/')[0],
	    'ver': userAgentParts[0].split('/')[1],
	    'system': userAgentParts[1],
	    'platform': userAgentParts[2].split(' ')[0],
	    'raw': userAgent
	}
}

const _getDeviceID = () => {
	let defer = q.defer();

	selectFields({dbName : 'device_mgmt', tableName : 'device', columns : ["dev_id"]})
	.then(response => {
		defer.resolve(response);
	}).catch(e => {
		console.log(e);
		defer.reject(e);
	})

    return defer.promise;
}

const _getSystemVersion = () => {
	let defer = q.defer();

	let cdn = '/opt/opencdn/CDN/version.txt';

	fs.readFile(cdn, 'utf-8', (err, data) => {
		if(err) {
			defer.reject(err);
		} else {
			defer.resolve(data);
		}
	});

    return defer.promise;
}

const _addAgnosticDataAndSave = (telemetryData, actor, timestamp) => {
    let defer = q.defer();

	const promises = [
		_getSystemVersion(),
		_getDeviceID()
	];

	q.all(promises)
		.then(values => {
			const systemVersion = values[0].replace(/\n$/, '');
			const deviceID = values[1][0].dev_id;

			telemetryData = {
				...telemetryData,
				'ets' : timestamp.getTime(),
				'ver' : '3.0',
				'actor' : {
					'id' : actor
				},
				'mid' : uniqid(`${deviceID}-`),
				'context': {
					'channel' : 'OpenRAP',
					'pdata' : {
						'pid' : prc.pid,
						'ver' : systemVersion,
						'id' : deviceID
					},
					'env' : 'Browser Plugin'
				}
			};

			console.log('Saving telemetry.'); // JSON.stringify(telemetryData, null, 4))
			saveTelemetry(telemetryData, 'gok');

            defer.resolve();
		})
		.catch(err => {
			console.log(err);
			defer.reject();
		});

	return defer.promise;
}

const saveTelemetryData = (req, res, next) => {
	const remoteAddress = req.connection.remoteAddress;
	const clientIP = remoteAddress.substring(remoteAddress.lastIndexOf(':') + 1);

	const timestamp = new Date(parseInt(req.query.timestamp));

	let telemetryData = { ...telemetryStructure };
	let uaspec = _getUaspecObject(req.headers);

	req.query.path = decodeURIComponent(req.query.path);

	/*
	* Populating event-specific telemetry data
	*/

	switch(req.route.path) {
		case '/gok/file' :
			const stat = fs.statSync(req.query.path);

			telemetryData = {
				...telemetryData,
				'eid': 'LOG',
				'edata': {
				    'type': 'api_call',
				    'level': 'INFO',
				    'message': 'Client requested content',
				    'params': [
						{
					        uaspec,
							'timestamp': _formatTimestamp(timestamp),
					        'query': req.query,
					        'results': {
								'file': path.basename(req.query.path),
								'size': _formatBytes(stat.size)
							}
					    }
					]
				}
			}

			break;

		case '/gok/file/search' :
			telemetryData = {
				...telemetryData,
				'eid': 'LOG',
			    'edata': {
			        'type': 'api_call',
			        'level': 'INFO',
			        'message': 'Client searched for content',
			        'params': [
						{
				            uaspec,
							'timestamp': _formatTimestamp(timestamp),
				            'query': req.query,
				        }
					]
			    }
			}

			break;
	}

	/*
	* Populating event-agnostic telemetry data
	*/

	_addAgnosticDataAndSave(telemetryData, clientIP, timestamp).then(value => {
        next();
	}).catch(err => console.log(err));
}

module.exports = {
	saveTelemetryData
}
