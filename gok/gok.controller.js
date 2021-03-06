const path          =   require('path');
const filesdk       =   require('../../../filesdk');
const searchsdk     =   require('../../../searchsdk');
const fs            =   require('fs');
const q             =   require('q');


const mapContentType = {
    '.ico'  : 'image/x-icon',
    '.html' : 'text/html',
    '.js'   : 'text/javascript',
    '.json' : 'application/json',
    '.css'  : 'text/css',
    '.png'  : 'image/png',
    '.jpg'  : 'image/jpeg',
    '.wav'  : 'audio/wav',
    '.mp3'  : 'audio/mpeg',
    '.mp4'  : 'video/mp4',
    '.svg'  : 'image/svg+xml',
    '.pdf'  : 'application/pdf',
    '.doc'  : 'application/msword'
};

let getFileList = (req, res) => {

    let response = {
        success : false,
        data : [],
        message : undefined
    }

    filesdk.readdir(req.query.path)
        .then((fileList) => {
            return prepareDetailedFileList(req.query.path, fileList);
        })
        .then((detailedFileList) => {
            response = { ...response, success : true, data : detailedFileList, message : 'File list retrieved' };
            res.status(200).json(response);
        })
        .catch((error) => {
            response = { ...response, message : error };
            res.status(200).json(response);
        });
}

let prepareDetailedFileList = (parentDirPath, fileList) => {
    let defer = q.defer();

    let eventualDetailedFileList = fileList.filter(file => !(/(^|\/)\.[^\/\.]/g).test(file)).map((file) => {
        let fullFilePath = path.join(parentDirPath, file);

        return getFileInfo(fullFilePath)
            .then((stats) => {
                // Other file details can be added as and when required
                return {
                    name : stats.name,
                    isDirectory : stats.isDirectory,
                    size : stats.size,
                    uploadedOn : stats.birthtime.toLocaleDateString('en-IN')
                }
            })
            .catch((error) => {
                throw error;
            });
    });

    q.all(eventualDetailedFileList)
        .then((detailedFileList) => {
            defer.resolve(detailedFileList);
        })
        .catch((error) => {
            defer.reject(error);
        });

    return defer.promise;
}

let getFileInfo = (filePath) => {
    let defer = q.defer();

    filesdk.getInfo(filePath)
        .then((stats) => {
            stats = {
                ...stats,
                name : path.basename(filePath),
                isDirectory : stats.isDirectory()
            }

            defer.resolve(stats);
        })
        .catch((error) => {
            defer.reject(error);
        });

    return defer.promise;
}

let getFileData = (req, res) => {

    let response = {
        success : false,
        data : undefined,
        message : undefined
    }

    const filePath = req.query.path;
    const range = req.headers.range;

    filesdk.getInfo(filePath)
        .then(stats => {
            if(stats.isDirectory()) {
                throw filePath + ' is a directory.';
            } else {
                const basename = path.basename(filePath);
                const extension = path.extname(filePath);
                const fileSize = stats.size;

                if(range) {
                    const parts = range.replace(/bytes=/, '').split('-');

                    const start = parseInt(parts[0], 10);
                    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                    const chunkSize = (end - start) + 1;

                    const file = fs.createReadStream(filePath, {start, end});

                    const head = {
                        'Content-Type' : mapContentType[extension] || 'text/plain',
                        'Content-Range' : `bytes ${start}-${end}/${fileSize}`,
                        'Accept-Ranges' : 'bytes',
                        'Content-Disposition' : `inline; filename=${path.basename(filePath)}"`,
                        'Content-Length' : chunkSize
                    };

                    res.writeHead(206, head);
                    file.pipe(res);

                } else {
                    const head = {
                        'Content-Type' : mapContentType[extension] || 'text/plain',
                        'Content-Disposition' : `inline; filename=${basename}"`,
                        'Content-Length' : fileSize
                    };

                    res.writeHead(200, head);
                    fs.createReadStream(filePath).pipe(res);
                }
            }
        })
        .catch((error) => {
            console.log(error);

            response = { ...response, message : error };
            res.status(200).json(response);
        });
}

let getFileMetaData = (cleanedResults) => {
    let defer = q.defer();

    let allSearchedFileList = cleanedResults.map(file => {
        let pathtoEachFile = path.join(file.path, file.name);
        return getFileInfo(pathtoEachFile)
            .then((stats) => {
                return {
                    pathtoEachFile,
                    isDirectory : stats.isDirectory,
                    size : stats.size,
                    uploadedOn : stats.birthtime.toLocaleDateString('en-IN')
                }
            })
            .catch((error) => {
                throw error;
            });
    })

    q.all(allSearchedFileList)
        .then((detailedFileList) => {
            defer.resolve(detailedFileList);
        })
        .catch((error) => {
            defer.reject(error);
        });
    return defer.promise;
}

let performSearch = (req, res) => {
    let response = {
        success : false,
        data : undefined,
        message : undefined
    }

    const queryString = req.query.query;

    const regExpQuery = queryString
                            .split(/[\s.-]/)
                            .reduce((temp, item) => {
                                temp.push({
                                    "regexp" : `.*${item.toLowerCase()}.*`,
                                    "field" : "name"
                                })
                                return temp;
                            }, []);

    searchsdk.advancedSearch({
            indexName : 'gok.db',
            query : {
                "disjuncts" :
                    []
                    .concat(regExpQuery)
                    .concat({
                        "match" : queryString,
            			"analyzer" : "standard",
                        "field" : "path"
                    })
            }
        })
        .then((res) => {
            return JSON.parse(res.body).hits.map(item => searchsdk.getDocument({ indexName : item.index, documentID : item.id }));
        })
        .then((promises) => {
            return q.all(promises);
        })
        .then((results) => {
            let cleanedResults = results.map(item => JSON.parse(item.body).fields);

            // To show only folder specific files
            // .filter(item => item.path.startsWith(req.query.path));

            getFileMetaData(cleanedResults)
                .then((detailedFileList) => {
                    response = { ...response, success : true, data : detailedFileList, message : 'Search hits retrieved.' };
                    res.status(200).json(response);
                })
        })
        .catch((error) => {
            response = { ...response, message : error };
            res.status(200).json(response);
        });
}

module.exports = {
    getFileList,
    getFileData,
    performSearch,
    prepareDetailedFileList
}
