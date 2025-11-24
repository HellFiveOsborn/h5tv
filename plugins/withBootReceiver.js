const { withAndroidManifest } = require('@expo/config-plugins');

const withBootReceiver = (config) => {
    return withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults;

        // Add permission
        if (!androidManifest.manifest['uses-permission']) {
            androidManifest.manifest['uses-permission'] = [];
        }
        const permissions = androidManifest.manifest['uses-permission'];
        if (!permissions.find((p) => p.$['android:name'] === 'android.permission.RECEIVE_BOOT_COMPLETED')) {
            permissions.push({
                $: {
                    'android:name': 'android.permission.RECEIVE_BOOT_COMPLETED',
                },
            });
        }

        // Add receiver
        const mainApplication = androidManifest.manifest.application[0];
        if (!mainApplication.receiver) {
            mainApplication.receiver = [];
        }

        // Check if receiver already exists to avoid duplicates
        const receiverExists = mainApplication.receiver.some(
            (r) => r.$['android:name'] === '.BootReceiver'
        );

        if (!receiverExists) {
            mainApplication.receiver.push({
                $: {
                    'android:name': '.BootReceiver',
                    'android:enabled': 'true',
                    'android:exported': 'true',
                },
                'intent-filter': [
                    {
                        action: [
                            {
                                $: {
                                    'android:name': 'android.intent.action.BOOT_COMPLETED',
                                },
                            },
                            {
                                $: {
                                    'android:name': 'android.intent.action.QUICKBOOT_POWERON',
                                },
                            },
                        ],
                    },
                ],
            });
        }

        return config;
    });
};

module.exports = withBootReceiver;
