import React, { Component } from 'react';
import { Grid } from 'semantic-ui-react';

import { NavigationBar } from './components/NavigationBar';
import { SideBar } from './components/SideBar';
import { ContentArea } from './components/ContentArea';

import axios from 'axios';
import path from 'path';

import { BASE_URL } from './config/config';


class App extends Component {

    constructor(props) {
        super(props);

        this.state = {
            currentPath : sessionStorage.getItem('pathVisited') || this.props.root,
            fileList : [],
            topLevelDirectories : [],
        }
    }

    componentDidMount() {
        this.populateFileList();
    }

    atHome = () => this.state.currentPath === this.props.root;

    populateFileList = () => {
        axios.get(`${BASE_URL}/file/list`, { params : { path : this.state.currentPath } })
            .then((response) => {
                this.setState({...this.state, fileList : response.data.data}, () => {
                    if(this.atHome()) {
                        sessionStorage.setItem('topLevelDirectories', JSON.stringify(this.state.fileList));
                    }

                    this.setState({...this.state, topLevelDirectories : JSON.parse(sessionStorage.getItem('topLevelDirectories'))});
                });

            })
            .catch((error) => {
                console.log(error);
                alert('Error occurred while reading data.');
            })
    }

    setPath = (newPath) => {
        newPath = newPath.replace(new RegExp(path.sep+'$'), ''); // trims path separator ('/' on linux) from the right end
        sessionStorage.setItem('pathVisited', newPath);
        this.setState({ currentPath : newPath }, this.populateFileList);
    }

    handleSearchClick = (e, searchText) => {
        const params = {
            query : searchText,
            path : this.state.currentPath,
            timestamp : `${new Date().getTime()}`
        }

        axios.get(`${BASE_URL}/file/search`, { params })
            .then((response) => {
                let searchHits = response.data.data.map(item => ({ name : path.join(item.path, item.name), isDirectory : false }));

                this.setState({ ...this.state, fileList : searchHits });
            })
            .catch((error) => {
                console.log(error);
                alert('Search failed.');
            })
    }

    render() {
        return (
            <Grid columns='equal' style={{ margin : '0' }}>
                <Grid.Row style={{ paddingRight : '0.5em', position : 'fixed', top : '0', zIndex : 2, backgroundColor : 'white' }} stretched>
                    <NavigationBar
                        basePath={this.props.root}
                        currentPath={this.state.currentPath} onSearchClick={this.handleSearchClick}
                        setPath={this.setPath}
                    />
                </Grid.Row>

                <Grid.Row style={{ paddingTop : '10em', zIndex : 1, height: '100vh' }} stretched>
                    <Grid.Column only='computer' computer={3}>
                        <SideBar
                            fileList={this.state.topLevelDirectories}
                            basePath={this.props.root}
                            currentPath={this.state.currentPath}
                            setPath={this.setPath}
                        />
                    </Grid.Column>

                    <Grid.Column mobile={16} computer={13} style={{ overflowY : 'scroll'}}>
                        <ContentArea
                            fileList={this.state.fileList}
                            basePath={this.props.root}
                            currentPath={this.state.currentPath}
                            setPath={this.setPath}
                            handleModalOpen={this.handleModalOpen}/>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}

export default App;
