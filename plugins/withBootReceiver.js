const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const BOOT_RECEIVER_CODE = `package {{PACKAGE_NAME}}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "H5TV_BootReceiver"
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "BootReceiver triggered with action: \${intent.action}")
        
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            
            try {
                // Verificar se a opção de iniciar no boot está habilitada
                // AsyncStorage do React Native usa SharedPreferences com esse nome
                val prefs: SharedPreferences = context.getSharedPreferences(
                    "RCTAsyncLocalStorage_V1",
                    Context.MODE_PRIVATE
                )
                
                // O AsyncStorage armazena como string JSON, então "true" está entre aspas
                val startOnBoot = prefs.getString("START_ON_BOOT", null)
                Log.d(TAG, "START_ON_BOOT value: \$startOnBoot")
                
                // Verificar se é "true" (com ou sem aspas)
                val shouldStart = startOnBoot == "true" || startOnBoot == "\\"true\\""
                
                if (shouldStart) {
                    Log.d(TAG, "Starting app on boot...")
                    val launchIntent = context.packageManager.getLaunchIntentForPackage(
                        context.packageName
                    )
                    launchIntent?.let {
                        it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        it.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                        it.addFlags(Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                        context.startActivity(it)
                        Log.d(TAG, "App started successfully")
                    } ?: run {
                        Log.e(TAG, "Could not get launch intent for package")
                    }
                } else {
                    Log.d(TAG, "Start on boot is disabled")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error in BootReceiver: \${e.message}", e)
            }
        }
    }
}
`;

const withBootReceiverClass = (config) => {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            const packageName = config.android?.package || 'com.hellfiveosborn.H5TV';
            const packagePath = packageName.replace(/\./g, '/');

            const projectRoot = config.modRequest.projectRoot;
            const bootReceiverPath = path.join(
                projectRoot,
                'android',
                'app',
                'src',
                'main',
                'java',
                packagePath,
                'BootReceiver.kt'
            );

            // Criar o diretório se não existir
            const dir = path.dirname(bootReceiverPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Gerar o código com o package name correto
            const code = BOOT_RECEIVER_CODE.replace('{{PACKAGE_NAME}}', packageName);

            // Escrever o arquivo
            fs.writeFileSync(bootReceiverPath, code);
            console.log(`[withBootReceiver] Created BootReceiver.kt at ${bootReceiverPath}`);

            return config;
        },
    ]);
};

const withBootReceiverManifest = (config) => {
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
                    'android:directBootAware': 'true',
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
                            {
                                $: {
                                    'android:name': 'android.intent.action.LOCKED_BOOT_COMPLETED',
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

const withBootReceiver = (config) => {
    // Primeiro adiciona a classe BootReceiver.kt
    config = withBootReceiverClass(config);
    // Depois modifica o manifest
    config = withBootReceiverManifest(config);
    return config;
};

module.exports = withBootReceiver;
