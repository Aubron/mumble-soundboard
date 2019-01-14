import React from 'react';
import Grid from '@material-ui/core/Grid'
import Sound from './Sound';



export default ({sounds, refresh}) => {
    return (
        <Grid container style={{marginTop: 64}}>
            {sounds.map((sound) => <Sound key={sound.id} sound={sound} refresh={refresh} />)}
        </Grid>
    )
}