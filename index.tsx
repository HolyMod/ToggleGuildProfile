import {Webpack, Injector as InjectorModule, DiscordModules, ReactTools, DOM, Settings} from "@Holy";
import config from "./manifest.json";
import React, {useContext, useState} from "react";
import ToggleGuildProfileButton from "./components/button";
import styles from "./style.scss";
import SettingsPanel from "./components/settings";

type ValueOf<T> = T[keyof T];

enum ViewTypes {
    DEFAULT,
    CUSTOM
};

const {GuildMemberStore, UserStore, Flux} = DiscordModules;
const ViewContext = React.createContext({active: false, userId: "", guildId: "", viewType: ViewTypes.CUSTOM, setView: (type: ValueOf<typeof ViewTypes>) => {}});
const Injector = InjectorModule.create(config.name);

const [
    UserPopoutComponents,
    AvatarUtils,
    UserPopoutContainer,
    UserBanner,
    UserPopoutClasses,
    UserBio,
    userBioClasses,
    UserPopoutInlineAvatar
] = Webpack.bulk(
    ["UserPopoutAvatar"],
    ["getGuildMemberAvatarURL"],
    (m: any) => m?.type?.displayName === "UserPopoutContainer",
    Webpack.Filters.byDisplayName("UserBanner", true),
    ["userPopout", "headerNormal"],
    Webpack.Filters.byDisplayName("UserBio", true),
    ["aboutMeBody", "aboutMeTitle"],
    Webpack.Filters.byDisplayName("UserPopoutInlineAvatar", true)
);

export default class ToggleGuildProfile {
    onStart(): void {
        this.patchUserPopoutAvatar();
        this.patchUserPopout();
        this.patchUserBanner();
        this.patchUserBio();
        this.patchUserPopoutProfileText();
        this.patchUserPopoutInlineAvatar();

        DOM.injectCSS(config.name, styles.replace("REPLACE_CLASS_HEADER_NORMAL", UserPopoutClasses.headerNormal));

        Settings.mount(SettingsPanel);
    }

    async patchUserPopoutAvatar() {
        function PatchedAvatar({__TGP_ORIGINAL: Original, ...props}) {
            const {active, userId, guildId, viewType} = useContext(ViewContext);
            const user = Flux.useStateFromStores([UserStore], () => UserStore.getUser(userId));
            const member = Flux.useStateFromStores([GuildMemberStore], () => GuildMemberStore.getMember(guildId, user?.id));

            if (!user) return <Original {...props} />;

            if (!active || viewType === ViewTypes.DEFAULT || user.bot || !member?.avatar) return (
                <Original {...props} src={AvatarUtils.getUserAvatarURL(user, true, 80)} />
            );

            return (
                <Original {...props} src={AvatarUtils.getGuildMemberAvatarURL({
                    userId: user.id,
                    avatar: member.avatar,
                    guildId: guildId
                }, true, 80)} />
            );
        }

        Injector.inject({
            module: UserPopoutComponents,
            method: "UserPopoutAvatar",
            after: (_, [props], ret) => {
                const avatar = ReactTools.findInReactTree(ret, e => e?.props && Reflect.has(e.props, "isMobile"));

                if (!avatar) return;
                const original = avatar.type;
                avatar.type = PatchedAvatar;
                Object.assign(avatar.props, {__TGP_ORIGINAL: original});
            }
        });
    }

    async patchUserPopout(): Promise<void> {
        function PatchedUserPopout({__TGP_ORIGINAL: original, ...props}) {
            const shouldShowRegularByDefault = Settings.useSettings(() => Settings.get("shouldShowRegularByDefault", false));
            const [viewType, setViewType] = useState(shouldShowRegularByDefault ? ViewTypes.DEFAULT : ViewTypes.CUSTOM);
            if (!props.guildId) return original(props);

            const value = {
                active: true,
                userId: props.user?.id ?? props.userId,
                guildId: props.guildId,
                viewType,
                setView: type => setViewType(type)
            };

            return (
                <ViewContext.Provider value={value}>
                    {original(props)}
                </ViewContext.Provider> 
            );
        }

        Injector.inject({
            module: UserPopoutContainer,
            method: "type",
            after: (_, [props], ret) => {
                const original = ret.type;
                ret.type = PatchedUserPopout;
                Object.assign(ret.props, {__TGP_ORIGINAL: original});
            }
        });
    }

    async patchUserBanner(): Promise<void> {
        function PatchedUserBanner({children, ...props}) {
            let {active, viewType, setView} = useContext(ViewContext);
            if (!active) return children;
            const guildMember = Flux.useStateFromStores([GuildMemberStore], () => {
                return GuildMemberStore.getMember(props.guildId, props.user?.id);
            });

            try {
                const banner = ReactTools.findInReactTree(children, e => e?.style?.backgroundImage);
                if (!banner || !guildMember) return children;

                if (guildMember.banner) switch (viewType) {
                    case ViewTypes.DEFAULT: {
                        const src = AvatarUtils.getUserBannerURL({
                            canAnimate: true,
                            id: props.user.id,
                            size: 300,
                            banner: props.user.banner
                        });
                        banner.style.backgroundImage = `url(${src})`;
                    } break;
                        
                    case ViewTypes.CUSTOM: {
                        const src = AvatarUtils.getGuildMemberBannerURL({
                            canAnimate: true,
                            id: props.user.id,
                            guildId: props.guildId,
                            size: 300,
                            banner: guildMember.banner
                        });
                        banner.style.backgroundImage = `url(${src})`;
                    } break;
                }
            } catch (error) {
                console.error(error);
            }

            return (
                <React.Fragment>
                    <ToggleGuildProfileButton
                        mode={viewType === ViewTypes.DEFAULT}
                        onClick={() => setView(++viewType % 2)}
                    />
                    {children}
                </React.Fragment>
            );
        }

        Injector.inject({
            module: UserBanner,
            method: "default",
            after: (_, [props], ret) => {
                return (
                    <PatchedUserBanner {...props}>{ret}</PatchedUserBanner>
                );
            }
        });
    }
    
    async patchUserBio(): Promise<void> {
        function PatchedUserBio({userBio}) {
            const {active, viewType, userId, guildId} = useContext(ViewContext);
            const member = Flux.useStateFromStores([GuildMemberStore], () => GuildMemberStore.getMember(guildId, userId))
            const user = Flux.useStateFromStores([UserStore], () => UserStore.getUser(userId)); 

            if (!active || !member?.bio) return (
                <UserBio.default userBio={user?.bio ?? userBio} __patch />
            );

            switch (viewType) {
                case ViewTypes.CUSTOM: {
                    return (
                        <UserBio.default userBio={member.bio} __patch />
                    );
                };
                    
                case ViewTypes.DEFAULT: {
                    return (
                        <UserBio.default userBio={user.bio} __patch />
                    );
                }
            }
        };

        Injector.inject({
            module: UserBio,
            method: "default",
            before(_, [props]) {
                if (!props.className) props.className = userBioClasses.aboutMeBody;
            },
            after: (_, [props]) => {
                if (props.__patch) return;

                return (
                    <PatchedUserBio {...props} />
                );
            }
        });
    }

    async patchUserPopoutProfileText() {
        function PatchedHeader({__TGP_ORIGINAL: original, ...props}) {
            const {active, viewType} = useContext(ViewContext);
            if (!active || viewType === ViewTypes.CUSTOM) return original(props);

            const [children] = props.children;

            return original(Object.assign({}, props, {children}));
        }

        Injector.inject({
            module: UserPopoutComponents,
            method: "UserPopoutProfileText",
            after: (_, [props], ret) => {
                const header = ReactTools.findInReactTree(ret, e => e?.type?.displayName === "Header");
                if (!header) return;

                Object.assign(header.props, {__TGP_ORIGINAL: header.type});
                header.type = PatchedHeader;
            }
        });
    }

    async patchUserPopoutInlineAvatar() {
        function PatchedInlineAvatar({__TGP_ORIGINAL: original, ...props}) {
            const {active, viewType} = useContext(ViewContext);
            if (!active || viewType === ViewTypes.DEFAULT) return null;

            return original(props);
        }

        Injector.inject({
            module: UserPopoutInlineAvatar,
            method: "default",
            after: (_, __, ret) => {
                Object.assign(ret.props, {__TGP_ORIGINAL: ret.type});
                ret.type = PatchedInlineAvatar;
            }
        });
    }

    onStop(): void {
        Injector.uninject();
        DOM.clearCSS(config.name);

        Settings.unmount();
    }
}