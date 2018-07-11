import React, { Component } from 'react';
import { Segment, Icon, Card, Divider, Header, Modal } from 'semantic-ui-react';

import PDFViewer from 'mgr-pdf-viewer-react';

import _ from 'lodash';
import path from 'path';

import './style.css'

import { BASE_URL } from '../config/config';

const mapIcon = {
    '.ico'  : ['image outline', 'pink'],
    '.html' : ['html5', 'orange'],
    '.js'   : ['file code outline', 'green'],
    '.c'    : ['file code outline', 'green'],
    '.java' : ['file code outline', 'green'],
    '.py'   : ['file code outline', 'green'],
    '.xml'  : ['file code outline', 'green'],
    '.json' : ['file code outline', 'green'],
    '.css'  : ['css3', 'olive'],
    '.png'  : ['file image outline', 'pink'],
    '.jpg'  : ['file image outline', 'pink'],
    '.wav'  : ['file audio outline', 'violet'],
    '.mp3'  : ['file audio outline', 'violet'],
    '.mp4'  : ['file video outline', 'purple'],
    '.svg'  : ['file image outline', 'pink'],
    '.pdf'  : ['file pdf outline', 'red'],
    '.doc'  : ['file word outline', 'blue'],
    '.txt'  : ['file text outline', 'black'],
    '.zip'  : ['file archive outline', 'brown'],
    'dir'   : ['folder outline', 'yellow']
}

const AudioPlayer = (props) => {
    return (
        <Segment color='violet' padded='very' style={{marginTop: '10%'}}>
            <Header as='h1'>{path.basename(props.name)}</Header>
            <audio
                controls
                autoPlay
                src={props.src}
                type="audio/mpeg"
            />
        </Segment>
    )
}

const VideoPlayer = (props) => {
    return (
        <video
            controls
            autoPlay
            src={props.src}
            height={window.innerHeight - 60}
            width={window.innerWidth - 60}
        />
    )
}

class ContentArea extends Component {

    constructor(props) {
        super(props);

        this.state = {
            modalOpen : false,
            fileToBeViewed : null
        }
    }

    renderEmptyFolder() {
        return (
            <div className="watermark" >
                <Icon disabled name='file text' />
                <Header as='h2' disabled>
                    Folder is Empty
                </Header>
            </div>
        )
    }

    getFileViewer = () => {
        const encodedFileName = encodeURIComponent(this.state.fileToBeViewed);
        const url = `${BASE_URL}/file?path=${encodedFileName}&timestamp=${new Date().getTime()}`

        let fileViewer = undefined;

        let extension = path.extname(this.state.fileToBeViewed);

        // TODO create a map for file type

        switch(extension) {
            case '.mp3':
                fileViewer = (
                    <AudioPlayer src={url} name={this.state.fileToBeViewed}/>
                );
                break;
            case '.wav':
            case '.mp4':
                fileViewer = (
                    <VideoPlayer src={url} />
                );
                break;
            case '.pdf':
                let scale = 2;
                fileViewer = (
                    <PDFViewer
                        scale={scale}
                        document={{url}}
                    />
                );
                break;
            case '.html':
                fileViewer = (
                    <div>
                        <iframe
                            src={url}
                            title="HTML Display Component"
                            height={window.innerHeight - 60}
                            width={window.innerWidth - 60}
                            frameborder="0"
                            style={{background: '#FFFFFF'}}
                        />
                    </div>
                );
                break;
            default:
                fileViewer = (
                    <a href={url}>View in browser</a>
                );
        }

        return fileViewer;
    }

    handleModalOpen = () => this.setState({ modalOpen: true });

    handleModalClose = () => this.setState({ modalOpen: false });

    renderModal = () => {
        return (
            <Modal
                basic
                size='large'
                open={this.state.modalOpen}
                onClose={this.handleModalClose}
                closeOnEscape={true}
                closeIcon={{ name: 'remove', size: 'big', link: true, className: 'icon-placement'}}
            >
                <Modal.Content style={{ textAlign : 'center' }}>
                    { this.getFileViewer() }
                </Modal.Content>
            </Modal>
        )
    }

    handleFileItemClick = (e, file) => {
        if (file.isDirectory) {
            let newPath = path.join(this.props.currentPath, file.name.toString());
            this.props.setPath(newPath);
        } else {
            let filePath = path.resolve(this.props.currentPath, file.name);
            this.setState({ ...this.state, fileToBeViewed : filePath }, this.handleModalOpen);
        }
    }

    formatBytes = (bytes,decimals) => {
        if(bytes === 0) return '0 Bytes';
        var k = 1024,
            dm = decimals || 2,
            sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
            i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    renderFileList = () => {
        let dirArr = [], fileArr = [];
        for(let i=0;i<this.props.fileList.length;i++){
            if(this.props.fileList[i].isDirectory){
                dirArr.push(this.props.fileList[i]);
            } else {
                fileArr.push(this.props.fileList[i]);
            }
        }
        let arr = dirArr.concat(fileArr);
        return arr.map((file, index) => {
            let extension = path.extname(file.name);

            let icon = file.isDirectory ? mapIcon['dir'] : mapIcon[extension.toLowerCase()] || ['file outline', 'black'];

            return (
                <div
                    className='fileItem'
                    key={index}
                    style={{ textAlign : 'center', width : '8em', padding : '1em' }}>

                    <a
                        style={{ outline : 'none' }}
                        onClick={_.debounce((e) => this.handleFileItemClick(e, file), 500)}
                        onDoubleClick={(e) => console.log("double clicked")}>

                        <Icon link name={icon[0]} color={icon[1]} size='huge'/>

                        <span className="popup">
                            { path.relative(this.props.basePath, path.resolve(this.props.currentPath, file.name)) }
                            { file.isDirectory ? null : <span><br/>File Size: { this.formatBytes(file.size, 2) }</span>}
                            <br/>
                            Uploaded On : { file.uploadedOn }
                        </span>

                        <Divider fitted hidden style={{ paddingTop : '0.4em' }}/>

                        <div style={{ color : 'black', width : '100%', wordWrap : 'break-word', fontSize : '16px' }}>
                            { path.basename(file.name) }
                        </div>
                    </a>
                </div>
            );
        });
    }

    render() {
        return (
            <div>
                { this.renderModal() }

                <Card.Group style={{ fontSize : '18px', paddingLeft : '1em', paddingBottom : '3em', textAlign : 'left', width : '100%' }}>
                    {this.props.fileList.length > 0 && this.renderFileList()}
                    {this.props.fileList.length === 0 && this.renderEmptyFolder()}
                </Card.Group>
            </div>
        );
    }
}

export { ContentArea }
