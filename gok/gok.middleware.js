'use strict'

const uniqid = require('uniqid');
const fs = require('fs');
const path = require('path');
const q = require('q');
const mac = require('getmac');

const {
	saveTelemetry
} = require('../../../telemetrysdk');

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

const _getSystemVersion = () => {
	let defer = q.defer();

	let cdn = path.join(__dirname, '../../../CDN/version.txt');

	fs.readFile(cdn, 'utf-8', (err, data) => {
		if(err) {
			defer.reject(err);
		} else {
			defer.resolve(data);
		}
	});

    return defer.promise;
}

const _getTimestamp = () => {
	return new Date()
			.toISOString('en-IN')
			.replace(/T/, ' ')
			.replace(/\..+/, '');
}

const _getMacAddr = () => {
	let defer = q.defer();

	mac.getMac((err, addr) => {
		if(err) {
			console.log('Error encountered while fetching mac address.', err);
			defer.reject(err);
		} else {
			defer.resolve(addr);
		}
	});

    return defer.promise;
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

const saveTelemetryData = (req, res, next) => {
	const remoteAddress = req.connection.remoteAddress;
	const clientIP = remoteAddress.substring(remoteAddress.lastIndexOf(':') + 1);
	const timestamp = _getTimestamp();

	let telemetryData = { ...telemetryStructure };
	let uaspec = _getUaspecObject(req.headers);

	req.query.path = decodeURIComponent(req.query.path);

	/*
	* Populating event-specific telemetry data
	*/

	switch(req.route.path) {
		case '/gok/file' :
			// Temporarily here to provide data for visualization, needs changing
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
					        timestamp,
					        uaspec,
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
				            timestamp,
				            uaspec,
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

	telemetryData = {
		...telemetryData,
		'ets': new Date().getTime(),
		'ver': '3.0',
		'actor': {
			'id': clientIP
		},
		'context': {
			'channel': 'OpenRAP',
			'pdata': {
				'pid': require('process').pid
			},
			'env': 'GoK Plugin'
		}
	}

	_getSystemVersion()
		.then(systemVersion => {
			telemetryData = {
				...telemetryData,
				'context': {
					...telemetryData.context,
					'pdata' : {
						...telemetryData.context.pdata,
						'ver' : systemVersion.replace(/\n$/, '')
					}
				}
			}

			return _getMacAddr();
		})
		.then(macAddr => {
			const deviceID = macAddr;

			telemetryData = {
				...telemetryData,
				'mid' : uniqid(`${deviceID}-`),
				'context': {
					...telemetryData.context,
					'pdata' : {
						...telemetryData.context.pdata,
						'id' : deviceID
					},
				}
			}

			console.log('Saving telemetry'); // JSON.stringify(telemetryData, null, 4))

			saveTelemetry(telemetryData, 'gok');

			next();
		})
		.catch(err => console.log(err));
}

module.exports = {
	saveTelemetryData
}
