import React, { Component } from 'react';
import SearchBar from './SearchBar'
import SoundGrid from './SoundGrid'

class App extends Component {
  state = {
    searching: false,
    searchString: null,
    sounds: []
  }

  componentDidMount = async () => {
    this.refreshSounds()
  }

  refreshSounds = async () => {
    let sounds = await fetch(`${process.env.REACT_APP_SBAPI_ENDPOINT}/sounds`)
      .then(response => response.json())
    this.setState({
      sounds: sounds.Items
    })
  }

  setSearching(string) {
    this.setState({
      searching: true,
      searchString: string
    })
  }

  clearSearching() {
    this.setState({
      searching: false,
      searchString: null
    })
  }

  render() {
    return (
      <React.Fragment>
        <SearchBar setSearching={this.setSearching} clearSearching={this.clearSearching} refresh={this.refreshSounds} />
        <SoundGrid sounds={this.state.sounds} refresh={this.refreshSounds} />
      </React.Fragment>
    );
  }
}

export default App;
