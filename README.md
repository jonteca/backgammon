# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

# Backgammon Game

A 3D Backgammon game built with React Three Fiber.

## Board Texture Setup

The game requires a board texture image (`board.jpg`) in the `public` directory. The texture should be:

1. Dimensions: 2048x1024 pixels (2:1 ratio)
2. Layout:
   - 12 triangles on each side (top and bottom)
   - Alternating colors (traditionally brown/tan or black/white)
   - Center bar dividing the board
   - Outer border for the bearing off area

You can create this texture in any image editing software, or use a standard backgammon board texture.

### Quick Setup

1. Download a backgammon board texture
2. Save it as `board.jpg` in the `public` directory
3. Make sure the texture is oriented correctly:
   - Points 1-6 (light triangles) should be in the bottom right
   - Points 7-12 (dark triangles) should be in the bottom left
   - Points 13-18 (light triangles) should be in the top left
   - Points 19-24 (dark triangles) should be in the top right

## Game Features

- 3D rendered board and pieces
- Point numbers displayed on the board
- Highlighted legal moves
- Dice rolling
- Move validation
- Turn tracking

## How to Play

1. Click "Roll" to roll the dice
2. Yellow highlights show which pieces you can move
3. Click a highlighted piece to select it
4. Green highlights show where the selected piece can move
5. Click a green highlight to make your move
6. Continue until you've used all dice
7. Next player's turn begins

## Development

```bash
npm install
npm start
```
