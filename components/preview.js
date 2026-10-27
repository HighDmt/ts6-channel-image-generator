import React, {useContext, useEffect, useState} from 'react';
import Room from "./room";
import {defaultRoom, ImageManipulationContext} from "./imageManipulation";
import {Button, Callout} from "@blueprintjs/core";
import styled from "styled-components";

const ResetCallout = styled(Callout)`
  margin-top: 1em;

  button {
    margin-top: 1em;
  }
`

const Wrapper = styled.div`
  position: relative;
  height: 100%;
`

const ScrollWrapper = styled.div`
  position: relative;
  height: calc(100% - 140px);
  overflow: auto;
`

const Preview = () => {
    let {results, rooms, setRooms} = useContext(ImageManipulationContext);
    // Preview only: indexes of collapsed channels (does not affect export)
    const [collapsed, setCollapsed] = useState({});

    useEffect(() => {
        rooms.forEach((room, i) => {
            if (rooms.length < 2) return;

        })
    }, [rooms]);

    const updateNthRoom = (n, diff) => {
        let newRooms = rooms.map((room, i) => {
            if (i !== n) return room;
            return {...room, ...diff}
        });

        newRooms.forEach((room, i) => {
            if (i === 0) return;

            const prevRoom = newRooms[i - 1];

            if (room.depth - prevRoom.depth > 1) {
                newRooms[i] = {...room, depth: room.depth - 1}
            }
        })

        setRooms(newRooms);
    }

    const resetAllRooms = () => {
        setRooms(rooms.map((room, i) => defaultRoom));
        setCollapsed({});
    };

    let roomsIndex = 1, spacersIndex = 1;
    let hiddenBelowDepth = null; // Set while skipping the sub-channels of a collapsed channel

    return (
        <Wrapper>
            <ScrollWrapper>
                {results.map((result, i) => {
                    const room = rooms[i];

                    let maxDepth = 32;
                    if (i > 0) {
                        maxDepth = rooms[i - 1].depth + 1;
                    }
                    const name = room.spacer ? `Spacer #${spacersIndex++}` : `Channel #${roomsIndex++}`;

                    if (hiddenBelowDepth !== null && room.depth > hiddenBelowDepth) return null;
                    hiddenBelowDepth = null;

                    const hasChildren = i + 1 < results.length && rooms[i + 1].depth > room.depth;
                    const isCollapsed = hasChildren && !!collapsed[i];
                    if (isCollapsed) hiddenBelowDepth = room.depth;

                    return <Room
                        name={name}
                        image={result}
                        key={i}
                        isSpacer={room.spacer}
                        hasChildren={hasChildren}
                        collapsed={isCollapsed}
                        onToggleCollapse={() => setCollapsed((c) => ({...c, [i]: !c[i]}))}
                        depth={room.depth}
                        maxDepth={maxDepth}
                        setIsSpacer={() => updateNthRoom(i, {spacer: !room.spacer})}
                        onDepthUp={() => updateNthRoom(i, {depth: room.depth - 1})}
                        onDepthDown={() => updateNthRoom(i, {depth: room.depth + 1})}
                    />
                })}

            </ScrollWrapper>
            <ResetCallout icon={'info-sign'} title={'Customize your channels structure'} intent={"primary"}>
                You can use arrows on the right of the channel preview to make nested channels and toggle between normal
                channel and spacer.
                <Button
                    icon={'reset'}
                    outlined
                    fill
                    onClick={resetAllRooms}
                >
                    Reset
                </Button>
            </ResetCallout>
        </Wrapper>
    );
};

export default Preview;
