import React from 'react';
import styled from 'styled-components';
import {Button, Icon} from "@blueprintjs/core";
import {
    CHANNEL_BANNER_WIDTH,
    CHANNEL_DEPTH_OFFSET,
    CHANNEL_GAP,
    CHANNEL_HEIGHT,
    IMAGE_LEFT_HIDDEN,
    TS_IMAGE_SCALE
} from "./imageManipulation";

// TS6 client colors (measured from screenshots, see CLAUDE.md section 4)
const ROW_BG = '#282A2C';
const NAME_BACKDROP = '#1B1B1F';
const NAME_BACKDROP_WIDTH = 150;   // Fixed, does not grow with long names
const NAME_BACKDROP_FADE_IN = 18;  // Backdrop fades in from the row's left edge, so a few px of image show
// Spacer name backdrop, measured with docs/spacer-test: darkens only (no blur), 93 % at the center, gone ~8 % from the ends
const SPACER_BACKDROP = 'linear-gradient(to right, transparent 8%, rgba(27, 27, 31, 0.93) 44%, rgba(27, 27, 31, 0.93) 56%, transparent 92%)';
const COLLAPSED_CHEVRON = '#1CC9FF';
const IMAGE_FADE_WIDTH = 84 * TS_IMAGE_SCALE; // Screen px; 84 image px at 1:1
const HOVER_GROW = 2;              // On hover TS6 grows the row 2 px on every side; the image stays put
const HOVER_OUTLINE = '#C0C0C0';

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
  position: relative;
  user-select: none;
  --grow: 0px;

  ${ControlsWrapper} {
    transition: opacity 0.5s 0.5s;
    opacity: 0.2;
  }

  &:hover {
    --grow: ${HOVER_GROW}px;

    ${ControlsWrapper} {
      transition: opacity 0.25s;
      opacity: 1;
    }
  }
`

// Visible row (background, image, backdrop). It grows by --grow on hover without moving the layout.
const RowSurface = styled.div`
  position: absolute;
  inset: calc(-1 * var(--grow));
  border-radius: calc(${({$isSpacer}) => $isSpacer ? CHANNEL_HEIGHT / 2 : 10}px + var(--grow));
  background-color: ${ROW_BG};
  overflow: hidden;

  ${RoomWrapper}:hover & {
    box-shadow: 0 0 0 1px ${HOVER_OUTLINE};
  }
`

// TS6 draws the banner at TS_IMAGE_SCALE, vertically centered in the row, anchored IMAGE_LEFT_HIDDEN image px left of
// the depth-0 row. The right-edge fade belongs to the image, not to the row.
const Image = styled.img`
  position: absolute;
  left: calc(${({$left}) => $left}px + var(--grow));
  top: 50%;
  transform: translateY(-50%);
  width: ${CHANNEL_BANNER_WIDTH * TS_IMAGE_SCALE}px;
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
    ? SPACER_BACKDROP
    : `linear-gradient(to right, transparent 0, ${NAME_BACKDROP} ${NAME_BACKDROP_FADE_IN}px 60%, transparent 100%)`};
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
  color: ${({$collapsed}) => $collapsed ? COLLAPSED_CHEVRON : 'white'};
  cursor: pointer;
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
 * @param collapsed If set the sub-channels are hidden and the expand button shows the collapsed arrow
 * @param onToggleCollapse Callback when the expand button is clicked
 * @param setIsSpacer Callback when Spacer toggle is clicked
 * @param onDepthUp Callback when depth down is clicked
 * @param onDepthDown Callback when depth up is clicked
 * @param depth Depth of the channel
 * @param maxDepth Maximum allowd depth (based on the depth of the paren channel)
 * @param other
 * @return {JSX.Element}
 * @constructor
 */
const Room = ({name, image, isSpacer, hasChildren, collapsed, onToggleCollapse, setIsSpacer, onDepthUp, onDepthDown, depth, maxDepth, ...other}) => {
    const depthOffset = depth * CHANNEL_DEPTH_OFFSET;

    return (
        <RoomWrapper $isSpacer={isSpacer} $depthOffset={depthOffset} {...other}>
            <RowSurface $isSpacer={isSpacer}>
                {image && <Image src={image} alt="Banner Fragment" $left={-(IMAGE_LEFT_HIDDEN * TS_IMAGE_SCALE + depthOffset)}/>}
                {image && <ImageMask $isSpacer={isSpacer}/>}
            </RowSurface>
            <RoomContent>
                {!isSpacer && <RoomIcon src={`roomIcon.svg`} alt={'Channel Icon'}/>}
                {isSpacer ? <SpacerTitle>{name}</SpacerTitle> : <RoomTitle>{name}</RoomTitle>}
            </RoomContent>
            {hasChildren && <ExpandButton $collapsed={collapsed} onClick={onToggleCollapse}>
                <Icon icon={collapsed ? 'chevron-left' : 'chevron-down'} iconSize={12}/>
            </ExpandButton>}
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
