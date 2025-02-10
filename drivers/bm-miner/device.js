'use strict';

const Homey = require('homey');
const BraiinsClient = require('../../lib/braiins_client').BraiinsClient;

class BraiinsMinerDevice extends Homey.Device {
    async onInit() {
        this.log('BraiinsMinerDevice has been initialized');

        // Inicializace klienta
        this.initClient();

        // Nastavení intervalů pro aktualizaci
        this.pollInterval = this.homey.setInterval(() => {
            this.pollDevice();
        }, 30000); // Každých 30 sekund

        // Registrace capability listeners
        this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));

        // První načtení dat
        this.pollDevice();
    }

    initClient() {
        const settings = this.getSettings();
        this.client = new BraiinsClient(
            settings.ip_address,
            settings.username,
            settings.password
        );
    }

    async pollDevice() {
        try {
            // Nejprve se ujistíme, že jsme autentizováni
            await this.client.authenticate();

            // Získání všech potřebných dat
            const [minerStats, coolingState, tunerState] = await Promise.all([
                this.client.getMinerStats(),
                this.client.getCoolingState(),
                this.client.getTunerState()
            ]);

            // Aktualizace capabilities
            await this.setCapabilityValue('measure_hashrate', 
                minerStats.miner_stats.real_hashrate.last_1m.gigahash_per_second);
            
            await this.setCapabilityValue('measure_power', 
                minerStats.power_stats.approximated_consumption.watt);

            await this.setCapabilityValue('measure_temperature', 
                coolingState.highest_temperature.temperature.degree_c);

            // Aktualizace fan_speed - bereme průměr všech ventilátorů
            const avgFanSpeed = coolingState.fans.reduce((acc, fan) => 
                acc + (fan.target_speed_ratio || 0), 0) / coolingState.fans.length;
            await this.setCapabilityValue('fan_speed', avgFanSpeed * 100);

            // Aktualizace mining_state
            let miningState = 'mining';
            if (!minerStats.miner_stats.real_hashrate.last_1m.gigahash_per_second) {
                miningState = 'paused';
            }
            await this.setCapabilityValue('mining_state', miningState);

            // Aktualizace tuner_mode
            const tunerMode = tunerState.power_target_mode_state ? 'power_target' : 'hashrate_target';
            await this.setCapabilityValue('tuner_mode', tunerMode);

            // Resetování chybového stavu
            await this.setCapabilityValue('alarm_generic', false);

        } catch (error) {
            this.error('Error polling device:', error);
            await this.setCapabilityValue('alarm_generic', true);
        }
    }

    async onCapabilityOnOff(value) {
        try {
            if (value) {
                await this.client.startMining();
            } else {
                await this.client.stopMining();
            }
            return true;
        } catch (error) {
            this.error('Failed to change mining state:', error);
            throw new Error('Failed to change mining state');
        }
    }

    async onSettings({ oldSettings, newSettings, changedKeys }) {
        // Pokud se změnily přihlašovací údaje, reinicializujeme klienta
        if (changedKeys.includes('ip_address') || 
            changedKeys.includes('username') || 
            changedKeys.includes('password')) {
            this.initClient();
            // Ověření nového připojení
            try {
                await this.client.authenticate();
            } catch (error) {
                throw new Error('Could not connect with new settings');
            }
        }

        // Pokud se změnil výkonový cíl
        if (changedKeys.includes('power_target_value') && 
            newSettings.target_mode === 'power_target') {
            await this.client.setPowerTarget(newSettings.power_target_value);
        }

        // Pokud se změnil hashrate cíl
        if (changedKeys.includes('hashrate_target_value') && 
            newSettings.target_mode === 'hashrate_target') {
            await this.client.setHashrateTarget(newSettings.hashrate_target_value);
        }

        // Pokud se změnil režim cíle
        if (changedKeys.includes('target_mode')) {
            if (newSettings.target_mode === 'power_target') {
                await this.client.setPowerTarget(newSettings.power_target_value);
            } else {
                await this.client.setHashrateTarget(newSettings.hashrate_target_value);
            }
        }
    }

    onDeleted() {
        // Vyčistíme interval při smazání zařízení
        this.homey.clearInterval(this.pollInterval);
    }
}

module.exports = BraiinsMinerDevice;