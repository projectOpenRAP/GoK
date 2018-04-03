import React from 'react';
import ReactDOM from 'react-dom';

import App from './App';

import './index.css';
import 'semantic-ui-css/semantic.min.css';
import '../node_modules/video-react/dist/video-react.css';

import { FS_ROOT } from './config/config';

ReactDOM.render(<App root={FS_ROOT}/>, document.getElementById('root'));
