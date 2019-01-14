import React from 'react';
import Grid from '@material-ui/core/Grid'
import ButtonBase from '@material-ui/core/ButtonBase'
import { withStyles } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';

const styles = (theme) => ({
    item: {
        backgroundColor: theme.palette.background.paper,
        minHeight: 64,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: theme.spacing.unit * 2,
        borderRight: `1px solid ${theme.palette.grey[300]}`,
        borderBottom: `1px solid ${theme.palette.grey[300]}`,
        width: '100%',
        overflow: 'hidden',
    }
})

const createSoundHandler = (id) => () => {
    fetch(`${process.env.REACT_APP_SBAPI_ENDPOINT}/sound`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            file: id
        })
    })
}

const createDeleteHandler = (id, refresh) => async (e) => {
    e.preventDefault();
    fetch(`${process.env.REACT_APP_SBAPI_ENDPOINT}/sound`, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            id,
        })
    })
        .then(() => {
            refresh()
        })
}

const Sound = ({sound, classes, refresh}) => {
    return (
        <Grid item xs={6} sm={4} md={3} xl={2} onClick={createSoundHandler(sound.id)} onContextMenu={createDeleteHandler(sound.id,refresh)}>
            <ButtonBase className={classes.item}>
                <Typography variant="h6" noWrap>{sound.name}</Typography>
            </ButtonBase>
        </Grid>
    )
    
}

export default withStyles(styles)(Sound)