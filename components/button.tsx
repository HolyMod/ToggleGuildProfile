import {DiscordModules} from "@Holy";
import Eye from "./icons/eye";

const {Button, Tooltips: {Tooltip}} = DiscordModules;

export default function ToggleGuildProfileButton({onClick, mode}) {
    return (
        <Tooltip position="top" text={mode ? "View Server Customized Profile" : "View Regular Profile"}>
            {props => (
                <Button
                    {...props}
                    look={Button.Looks.BLANK}
                    size={Button.Sizes.NONE}
                    onClick={onClick}
                    className="tgp-button"
                >
                    <Eye />
                </Button>
            )}
        </Tooltip>
    );
};