class VictoryScene extends Phaser.Scene {
  constructor() {
      super("victoryScene");
  }

  create() {
      this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 'Victory!', {
          fontFamily: 'Arial',
          fontSize: '48px',
          fill: '#ffffff'
      }).setScrollFactor(0).setOrigin(0.5, 0.5);

      this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 60, 'Press R to Restart', {
          fontFamily: 'Arial',
          fontSize: '24px',
          fill: '#ffffff'
      }).setScrollFactor(0).setOrigin(0.5, 0.5);

      this.rKey = this.input.keyboard.addKey('R');

      this.rKey.on('down', () => {
          this.scene.start('platformerScene');
      });
  }
}
