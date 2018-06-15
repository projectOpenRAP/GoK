const path          =   require('path');
const filesdk       =   require('../../../filesdk');
const searchsdk     =   require('../../../searchsdk');
const fs            =   require('fs');
const q             =   require('q');

const { FS_ROOT } = require('./config/config.js');

let { prepareDetailedFileList } = require('./gok.controller');
let { initiateTelemetrySync } = require('./gok.telemetry');

let createDirectoryIfNotExists = (dir) => {
    let defer = q.defer();

    fs.mkdir(dir, (error) => {
        if(!error) {
            defer.resolve(dir);
        } else if(error.code === 'EEXIST') {
            defer.resolve(dir);
        } else {
            defer.reject('Error occurred while creating directory. \n' + error);
        }
    })

    return defer.promise;
}

let generateMetaData = (parentDirPath) => {
    let defer = q.defer();

    let readDirQueue = [],
        fileMetaDataList = [];

    let walk = (dir) => {
        filesdk.readdir(dir)
            .then((fileList) => {
                return prepareDetailedFileList(dir, fileList);
            })
            .then((detailedFileList) => {
                detailedFileList.forEach((file) => {
                    if(file.isDirectory) {
                        readDirQueue.push(path.join(dir, file.name));
                    } else {
                        fileMetaDataList.push({
                            name : file.name,
                            path : dir
                        });
                    }
                });

                if(readDirQueue.length > 0) {
                    walk(readDirQueue.shift());
                } else {
                    defer.resolve(fileMetaDataList);
                }
            })
            .catch((error) => {
                console.log('Error occurred while generating metadata.');
                console.log(error);

                defer.reject(error);
            });
    }

    walk(parentDirPath);

    return defer.promise;
}

let generateMetaFileName = (metaFilePath, metaFileName) => {
    return [
        metaFilePath.replace(new RegExp(path.sep, 'g'), '_'),
        '_',
        metaFileName,
        '.json'
    ].join('');
}

let writeMetaDataToFolder = (fileMetaDataList) => {
    let defer = q.defer();

    let promises = fileMetaDataList.map((fileMetaData) => {

        // Creating .meta directory to store file metadata
        let metaDirPath = path.join(fileMetaData.path, '.meta');
        if (!fs.existsSync(metaDirPath)) {
            fs.mkdirSync(metaDirPath);
        }

        // Writing metadata
        let metaFileName = generateMetaFileName(fileMetaData.path, fileMetaData.name);

        let metaFilePath = path.join(metaDirPath, metaFileName);
        return filesdk.writeFile(metaFilePath, JSON.stringify(fileMetaData))
    });

    q.all(promises)
        .then((message) => defer.resolve(fileMetaDataList))
        .catch((error) => defer.reject(error));

    return defer.promise;
}

let indexMetaData = (fileMetaDataList) => {
    let defer = q.defer();

    searchsdk.init()
        .then((res) => {
            return searchsdk.getAllIndices();
        })
        .then((res) => {
            let availableIndices = JSON.parse(res.body).indexes;

            if (availableIndices.indexOf('gok.db') === -1) {
                return { message : 'Creating gok index now.' }
            } else {
                return searchsdk.deleteIndex({ indexName : 'gok.db' });
            }
        })
        .then((res) => {
            res.message && console.log(res.message);
            return searchsdk.createIndex({ indexName : 'gok.db'});
        })
        .then((res) => {
            return fileMetaDataList.map((fileMetaData) => {
                let metaFileName = generateMetaFileName(fileMetaData.path, fileMetaData.name);

                return searchsdk.addDocument({ indexName : 'gok.db', documentPath : path.join(fileMetaData.path, '.meta', metaFileName) })
            });
        })
        .then((promises) => {
            return q.all(promises);
        })
        .then((documentsAdded) => {
            documentsAdded.forEach((document) => {
                if(!document.success) {
                    console.log(document.err);
                    defer.reject(document.err);
                }
            });

            defer.resolve({ success : true });
        })
        .catch((error) => {
            return defer.reject(error);
        });


    return defer.promise;
}

let initializePlugin = () => {

    createDirectoryIfNotExists(FS_ROOT)
        .then(generateMetaData)
        .then(writeMetaDataToFolder)
        .then(indexMetaData)
        .then(({success}) => {
            if(success) {
                initiateTelemetrySync();
                console.log('Successfully initialized GoK plugin.');
            } else {
                throw new Error('Indexing failed.');
            }
        })
        .catch(error => {
            console.log('Error occurred during plugin initizalization.');
            console.log(error);
        });
}

module.exports = {
    initializePlugin
}
