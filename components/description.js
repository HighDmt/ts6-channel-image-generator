import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  h1 {
    margin-top: 0;
    font-size: 1.5em;
  }

  .p {
    font-size: 1.2em;
    margin-bottom: 10px;
    margin-top: 0;
  }
`

const GithubBadge = ({...other}) => (
    <iframe src="https://ghbtns.com/github-btn.html?user=HighDmt&repo=ts6-channel-image-generator&type=star&count=true"
            frameBorder="0" scrolling="0" width="150" height="20" title="GitHub" {...other}/>)

const StyledGithubBadge = styled(GithubBadge)`
  vertical-align: middle;
  margin-left: 0.6em;
`

const Description = () => {
    return (
        <Container>
            <h1>TeamSpeak 6 Channel Image Generator</h1>
            <div className={'p'}>Simple interactive tool for generating background images for channels in
                the <a href="https://teamspeak.com/en/downloads/" target={'_blank'} rel="noopener">TeamSpeak 6
                    client</a>.
                Upload any image and it will be resized and split into multiple images that you can simply use as
                banners on your channels.
            </div>

            <div className={'p'}>Contribute to the project
                on <a href="https://github.com/HighDmt/ts6-channel-image-generator" target={'_blank'}>GitHub (bug
                    reports are welcomed)</a> ! Based on
                the original <a href="https://github.com/pitkes22/ts5-channel-image-generator" target={'_blank'}>TeamSpeak
                    5 Channel Image Generator</a>.
            </div>

            <div className={'p'}>
                &copy; 2020 - <a href="mailto:padampasam@gmail.com" target={'_blank'}>Peter Adam</a> (original
                tool) &middot; TS6 fork by <a href="https://github.com/HighDmt" target={'_blank'}>HighDmt</a>
                <StyledGithubBadge/>
            </div>
        </Container>
    );
};

export default Description;
