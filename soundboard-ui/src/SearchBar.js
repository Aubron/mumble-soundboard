import React from 'react';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';

const handleFileChange = (refresh) => (e) => {
    if (e.target.files[0]) {
        let file = e.target.files[0];
        let formData = new FormData();
        formData.append('sound',file);
        var request = new XMLHttpRequest();
            e.target.value = null;
        request.open("PUT", `${process.env.REACT_APP_SBAPI_ENDPOINT}/sound`);
        request.send(formData);
        e.target.value = null;
        request.onload = () => {
            refresh()
        }
    }
    
    
}

export default ({refresh}) => {
    return (
        <AppBar>
            <Toolbar>
                <div style={{flexShrink: 1}}>
                    <input
                        accept="audio/mp3,audio/wav"
                        id="upload-button"
                        type="file"
                        style={{display: 'none'}}
                        onChange={handleFileChange(refresh)}
                    />
                    <label htmlFor="upload-button">
                        <IconButton component="span" color="inherit" style={{color: '#FFF'}}>
                            <CloudUploadIcon />
                        </IconButton>
                    </label>
                </div>
            </Toolbar>
        </AppBar>
    )
}