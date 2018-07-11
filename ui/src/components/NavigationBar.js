import React, { Component } from 'react';
import { Grid, Segment, Button, Icon, Input} from 'semantic-ui-react';

import path from 'path';

class NavigationBar extends Component {

    constructor(props) {
        super(props);

        this.state = {
            searchText : '',
            // inputIcon : 'search'
        }
    }

    // TODO : Perform a promise based search.
    // NOTE : Search willl have 3 states -- idle, doing (while fetching results), done (when results are fetched).
    // Promise can be used to detect all three states and change content area and icon accordingly.

    // toggleInputIcon = (callback) => {
    //     this.setState({ ...this.state, inputIcon : this.state.inputIcon === 'search' ? 'close' : 'search' }, callback);
    // }

    handleKeyUp = e => e.keyCode === 13 && this.handleSearchClick();

    handleSearchClick = (e) => {
        // this.toggleInputIcon(() => {
            // if(this.state.inputIcon === 'close') {
            if (this.state.searchText.length !== 0) {
                this.props.onSearchClick(e, this.state.searchText);
            }
            else {
                alert("Please enter the search box");
            }
        //     } else {
        //         this.props.setPath();
        //     }
        // });
    }

    handleInputTextChange = e => this.setState({ searchText : e.target.value });

    handleHomeClick = (e) => {
        this.props.setPath(this.props.basePath);
    }

    handleBackClick = (e) => {
        let newPath = path.join(this.props.currentPath, '../');
        this.props.setPath(newPath);
    }

    atHome = () => this.props.currentPath === this.props.basePath;

    render() {
        return (
            <Grid columns={4}>
                <Grid.Row stretched>
                    <Grid.Column mobile={4} tablet={2} computer={1}>
                        <Button
                            fluid
                            primary
                            icon={<Icon size='large' name='home'/>}
                            onClick={this.handleHomeClick}
                        />
                    </Grid.Column>

                    <Grid.Column mobile={4} tablet={2} computer={1}>
                        <Button
                            fluid
                            primary
                            icon={<Icon size='large' name='arrow up'/>}
                            onClick={this.handleBackClick}
                            disabled={this.atHome()}
                        />
                    </Grid.Column>

                    <Grid.Column only='computer tablet' tablet={8} computer={9}>
                        <Segment secondary size='big'>
                            {this.props.currentPath}
                        </Segment>
                    </Grid.Column>

                    <Grid.Column mobile={8} tablet={4} computer={5} onKeyUp={this.handleKeyUp}>
                        <Input
                            action={{ icon : 'search', size : 'big', color : 'blue', onClick : this.handleSearchClick }}
                            placeholder='Search...'
                            value={this.state.searchText}
                            size='big'
                            onChange={this.handleInputTextChange}
                            style={{ width : '30vw' }}
                        />
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}

export { NavigationBar }
