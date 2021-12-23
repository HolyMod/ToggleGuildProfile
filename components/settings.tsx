import {DiscordModules, Settings} from "@Holy";

const {SwitchItem} = DiscordModules;

export default function SettingsPanel() {
    return Settings.useSettings(() => {
        const shouldShowRegularByDefault = Settings.get("shouldShowRegularByDefault", false);

        return (
            <SwitchItem
                note="Shows the regular profile (without server profile customization) by default."
                value={shouldShowRegularByDefault}
                onChange={() => Settings.set("shouldShowRegularByDefault", !shouldShowRegularByDefault)}
            >Show Regular as Default</SwitchItem>
        );
    });
}