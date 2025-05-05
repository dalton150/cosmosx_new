// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CosmosXMatrix {
    IERC20 public usdc;
    address public owner;

    uint256[15] public slotPrices = [
        4e6, 5e6, 10e6, 20e6, 40e6, 80e6, 160e6, 320e6,
        640e6, 1280e6, 2560e6, 5120e6, 10240e6, 20480e6, 40960e6
    ];

    struct User {
        address referrer;
        address left;
        address right;
        address[] directs;
        uint256 registeredAt;
        uint256 activeSlots;
        bool isFlipped;
        bool autoUpgrade;
        uint256 savedForUpgrade;
        bool exists;
    }

    mapping(address => User) public users;
    mapping(address => mapping(uint256 => bool)) public userSlots;
    mapping(uint256 => uint256) public royaltyPerSlot;
    mapping(address => uint256) public totalEarnings;

    event Registered(address indexed user, address indexed referrer);
    event SlotPurchased(address indexed user, uint256 slot);
    event Deactivated(address indexed user);
    event AutoUpgrade(address indexed user, uint256 newSlot);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        owner = msg.sender;

        users[msg.sender] = User({
            referrer: address(0),
            left: address(0),
            right: address(0),
            directs: new address[](0),
            registeredAt: block.timestamp,
            activeSlots: 15,
            isFlipped: false,
            autoUpgrade: false,
            savedForUpgrade: 0,
            exists: true
        });

        for (uint8 i = 1; i <= 15; i++) {
            userSlots[msg.sender][i] = true;
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function register(address _referrer) external {
        require(!users[msg.sender].exists, "User exists");
        require(users[_referrer].exists, "Invalid referrer");
        require(msg.sender != _referrer, "Cannot refer yourself");

        address placement = findFreePlacement(_referrer);

        users[msg.sender] = User({
            referrer: _referrer,
            left: address(0),
            right: address(0),
            directs:  new address[](0) ,
            registeredAt: block.timestamp,
            activeSlots: 0,
            isFlipped: false,
            autoUpgrade: false,
            savedForUpgrade: 0,
            exists: true
        });

        if (users[placement].left == address(0)) {
            users[placement].left = msg.sender;
        } else {
            users[placement].right = msg.sender;
        }

        users[placement].directs.push(msg.sender);
        emit Registered(msg.sender, placement);
    }

    function findFreePlacement(address start) public view returns (address) {
        address[5000] memory queue;
        uint256 head = 0;
        uint256 tail = 0;
        queue[tail++] = start;

        while (head < tail) {
            address current = queue[head++];
            if (users[current].left == address(0) || users[current].right == address(0)) {
                return current;
            }
            if (users[current].left != address(0)) queue[tail++] = users[current].left;
            if (users[current].right != address(0)) queue[tail++] = users[current].right;
        }

        revert("No free position");
    }

    function purchaseSlot(uint256 slot) external {
        require(slot >= 1 && slot <= 15, "Invalid slot");
        require(users[msg.sender].exists, "User not registered");

        uint256 totalCost = 0;
        for (uint256 i = 1; i <= slot; i++) {
            if (!userSlots[msg.sender][i]) {
                totalCost += slotPrices[i - 1];
            }
        }

        require(totalCost > 0, "All slots already purchased");
        usdc.transferFrom(msg.sender, address(this), totalCost);

        for (uint256 i = 1; i <= slot; i++) {
            if (!userSlots[msg.sender][i]) {
                userSlots[msg.sender][i] = true;
                users[msg.sender].activeSlots++;
                distributeIncome(msg.sender, i);
                emit SlotPurchased(msg.sender, i);
            }
        }
    }

    function distributeIncome(address user, uint256 slot) internal {
        address ref = users[user].referrer;
        uint256 amount = slotPrices[slot - 1];
        uint256 directShare = (amount * 70) / 100;
        uint256 levelShare = (amount * 15) / 100;
        uint256 royaltyShare = (amount * 15) / 100;

        // Direct income
        if (ref != address(0)) {
            handleIncome(ref, directShare);
        }

        // Level income
        address upline = ref;
        for (uint8 i = 0; i < 15 && upline != address(0); i++) {
            uint256 levelAmount = levelShare / 15;
            handleIncome(upline, levelAmount);
            upline = users[upline].referrer;
        }

        // Royalty
        royaltyPerSlot[slot] += royaltyShare;
    }

    function handleIncome(address user, uint256 amount) internal {
        if (users[user].autoUpgrade) {
            users[user].savedForUpgrade += amount;
            tryAutoUpgrade(user);
        } else {
            usdc.transfer(user, amount);
            totalEarnings[user] += amount;
        }
    }

    function tryAutoUpgrade(address user) internal {
        uint256 currentSlot = users[user].activeSlots;
        if (currentSlot >= 15) return;

        uint256 nextSlotPrice = slotPrices[currentSlot];
        if (users[user].savedForUpgrade >= nextSlotPrice) {
            users[user].savedForUpgrade -= nextSlotPrice;
            users[user].activeSlots++;
            userSlots[user][currentSlot + 1] = true;
            distributeIncome(user, currentSlot + 1);
            emit AutoUpgrade(user, currentSlot + 1);
        }
    }

    function setAutoUpgrade(bool enabled) external {
        users[msg.sender].autoUpgrade = enabled;
    }

    function checkUserActivation(address user) external {
        require(users[user].exists, "User not found");
        require(!users[user].isFlipped, "Already flipped");

        if (block.timestamp > users[user].registeredAt + 7 days) {
            if (users[user].directs.length < 2) {
                users[user].isFlipped = true;
                users[user].referrer = address(0);
                emit Deactivated(user);
            }
        }
    }

    // ---------- Public Getters for Frontend ----------

    function getReferrer(address user) external view returns (address) {
        return users[user].referrer;
    }

    function getDirects(address user) external view returns (address[] memory) {
        return users[user].directs;
    }

    function getActiveSlots(address user) external view returns (uint256) {
        return users[user].activeSlots;
    }

    function getSlotStatus(address user, uint256 slot) external view returns (bool) {
        return userSlots[user][slot];
    }

    function getTotalEarnings(address user) external view returns (uint256) {
        return totalEarnings[user];
    }

    function getRegistrationTime(address user) external view returns (uint256) {
        return users[user].registeredAt;
    }

    function isUserFlipped(address user) external view returns (bool) {
        return users[user].isFlipped;
    }

    function isAutoUpgradeEnabled(address user) external view returns (bool) {
        return users[user].autoUpgrade;
    }

    function getSavedForUpgrade(address user) external view returns (uint256) {
        return users[user].savedForUpgrade;
    }

    function getRoyaltyForSlot(uint256 slot) external view returns (uint256) {
        return royaltyPerSlot[slot];
    }

    // Team Tree for UI (up to 3 levels)
    function getTeamTree(address user) external view returns (
        address left,
        address right,
        address leftLeft,
        address leftRight,
        address rightLeft,
        address rightRight
    ) {
        left = users[user].left;
        right = users[user].right;

        if (left != address(0)) {
            leftLeft = users[left].left;
            leftRight = users[left].right;
        }

        if (right != address(0)) {
            rightLeft = users[right].left;
            rightRight = users[right].right;
        }
    }

    // ---------- Admin: Distribute Royalty ----------

    function distributeRoyalty(uint256 slot, address[] calldata usersList) external onlyOwner {
        uint256 total = royaltyPerSlot[slot];
        require(total > 0, "Nothing to distribute");
        uint256 share = total / usersList.length;

        for (uint256 i = 0; i < usersList.length; i++) {
            usdc.transfer(usersList[i], share);
            totalEarnings[usersList[i]] += share;
        }

        royaltyPerSlot[slot] = 0;
    }
}