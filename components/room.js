import React from 'react';
import styled from 'styled-components';
import {Button, Icon} from "@blueprintjs/core";
import {
    CHANNEL_BANNER_WIDTH,
    CHANNEL_DEPTH_OFFSET,
    CHANNEL_GAP,
    CHANNEL_HEIGHT,
    IMAGE_LEFT_HIDDEN
} from "./imageManipulation";

// TS6 client colors (measured from screenshots, see CLAUDE.md section 4)
const ROW_BG = '#282A2C';
const NAME_BACKDROP = '#1B1B1F';
const NAME_BACKDROP_WIDTH = 150;
const IMAGE_FADE_WIDTH = 84;

const ControlsWrapper = styled.div`
  position: absolute;
  right: ${({$hasChevron}) => $hasChevron ? 32 : 6}px;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  z-index: 2;
`

const RoomWrapper = styled.div`
  height: ${CHANNEL_HEIGHT}px;
  margin-bottom: ${CHANNEL_GAP}px;
  margin-left: ${({$depthOffset}) => $depthOffset}px;
  width: calc(100% - ${({$depthOffset}) => $depthOffset}px);
  border-radius: ${({$isSpacer}) => $isSpacer ? CHANNEL_HEIGHT / 2 : 10}px;
  background-color: ${ROW_BG};
  overflow: hidden;
  position: relative;
  user-select: none;

  ${ControlsWrapper} {
    transition: opacity 0.5s 0.5s;
    opacity: 0.2;
  }

  &:hover {
    ${ControlsWrapper} {
      transition: opacity 0.25s;
      opacity: 1;
    }
  }
`

// TS6 draws the banner 1:1, vertically centered in the row, anchored IMAGE_LEFT_HIDDEN px left of the depth-0 row.
// The right-edge fade belongs to the image (500 px), not to the row.
const Image = styled.img`
  position: absolute;
  left: ${({$left}) => $left}px;
  top: 50%;
  transform: translateY(-50%);
  width: ${CHANNEL_BANNER_WIDTH}px;
  max-width: none;
  height: auto;
  -webkit-mask-image: linear-gradient(to right, black calc(100% - ${IMAGE_FADE_WIDTH}px), transparent 100%);
  mask-image: linear-gradient(to right, black calc(100% - ${IMAGE_FADE_WIDTH}px), transparent 100%);
`

const ImageMask = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  max-width: 100%;
  width: ${({$isSpacer}) => $isSpacer ? '100%' : `${NAME_BACKDROP_WIDTH}px`};
  background: ${({$isSpacer}) => $isSpacer
    ? 'linear-gradient(to right, transparent 0%, rgba(27, 27, 31, 0.85) 50%, transparent 100%)'
    : `linear-gradient(to right, ${NAME_BACKDROP} 0 60%, transparent 100%)`};
`

const RoomContent = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  align-items: center;
`

const RoomIcon = styled.img`
  position: absolute;
  left: 11px;
  width: 20px;
  height: 20px;
`

const RoomTitle = styled.span`
  position: absolute;
  left: 42px;
  font-size: 15px;
  color: #D4D4D5;
  white-space: nowrap;
`;

const SpacerTitle = styled.span`
  width: 100%;
  font-size: 15px;
  font-weight: 700;
  color: #F0F0F0;
  text-align: center;
  white-space: nowrap;
`

const ExpandButton = styled.div`
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 16px;
  border-radius: 5px;
  background-color: rgba(27, 24, 36, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 1;
`

const RoomButton = ({...other}) => (<Button
    small={true}
    outlined={true}
    {...other}
/>)

const StyledRoomButton = styled(RoomButton)`
  zoom: 0.7;
  margin-right: 0.2em;
  background-color: rgba(27, 27, 31, 0.85) !important;
`

/**
 * Renders one channel in the preview. It should be rendered exactly the same way as in TeamSpeak 6 Client.
 *
 * @param name Name of the room
 * @param image Background image of the room (URL)
 * @param isSpacer If set room will render as spacer
 * @param hasChildren If set the expand button is rendered (next room is nested in this one)
 * @param setIsSpacer Callback when Spacer toggle is clicked
 * @param onDepthUp Callback when depth down is clicked
 * @param onDepthDown Callback when depth up is clicked
 * @param depth Depth of the channel
 * @param maxDepth Maximum allowd depth (based on the depth of the paren channel)
 * @param other
 * @return {JSX.Element}
 * @constructor
 */
const Room = ({name, image, isSpacer, hasChildren, setIsSpacer, onDepthUp, onDepthDown, depth, maxDepth, ...other}) => {
    const depthOffset = depth * CHANNEL_DEPTH_OFFSET;

    return (
        <RoomWrapper $isSpacer={isSpacer} $depthOffset={depthOffset} {...other}>
            {image && <Image src={image} alt="Banner Fragment" $left={-(IMAGE_LEFT_HIDDEN + depthOffset)}/>}
            {image && <ImageMask $isSpacer={isSpacer}/>}
            <RoomContent>
                {!isSpacer && <RoomIcon src={`roomIcon.svg`} alt={'Channel Icon'}/>}
                {isSpacer ? <SpacerTitle>{name}</SpacerTitle> : <RoomTitle>{name}</RoomTitle>}
            </RoomContent>
            {hasChildren && <ExpandButton><Icon icon={'chevron-down'} iconSize={12}/></ExpandButton>}
            <ControlsWrapper $hasChevron={hasChildren}>
                {depth === 0 && <StyledRoomButton onClick={setIsSpacer}>{isSpacer ? 'channel' : 'spacer'}</StyledRoomButton>}
                {!isSpacer && <>
                    <StyledRoomButton onClick={onDepthUp} icon={'chevron-left'} disabled={depth <= 0}/>
                    <StyledRoomButton onClick={onDepthDown} icon={'chevron-right'} disabled={depth >= 32 || depth >= maxDepth}/>
                </>}
            </ControlsWrapper>
        </RoomWrapper>
    );
};

export default Room;
