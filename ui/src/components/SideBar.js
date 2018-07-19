import React, { Component } from 'react';
import { Menu } from 'semantic-ui-react';

import path from 'path';

class SideBar extends Component {

    updateCurrentDirectory = () => {
        let newPath = path.join(this.props.basePath, this.state.activeDirectory);
        this.props.setPath(newPath);
    }

    handleItemClick = (e, { name }) => {
        this.setState({ activeDirectory : name }, this.updateCurrentDirectory);
        this.props.disableSearchComponent();
    }

    atHome = () => this.props.currentPath === this.props.basePath;

    renderDirectoryList = () => {
        return this.props.fileList.filter(file => file.isDirectory).map((file, index) => <Menu.Item key={index} name={file.name} active={this.atHome() ? false : path.basename(this.props.currentPath) === file.name} onClick={this.handleItemClick} />);
    }

    render() {
        return (
            <Menu size='massive' fluid vertical>
                { this.props.fileList && this.renderDirectoryList() }
            </Menu>
        )
    }
}

export { SideBar }
