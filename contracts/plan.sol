// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CosmosXMatrix {
    IERC20 public usdc;
    address public owner;
    uint256 private  levelReserve;
    address public rootUser;

    uint256[15] public slotPrices = [
        4e6, 5e6, 10e6, 20e6, 40e6, 80e6, 160e6, 320e6,
        640e6, 1280e6, 2560e6, 5120e6, 10240e6, 20480e6, 40960e6
    ];

    struct User {
        address referrer;
        address placementUpline;
        address left;
        address right;
        address[] directs;
        uint256 registeredAt;
        uint256 activatedAt;
        uint256 activeSlots;
        bool isFlipped;
        bool autoUpgrade;
        uint256 savedForUpgrade;
        bool exists;
        bool isActive;
        uint256 lastIncomeAt;
    }

    struct Earnings {
        uint256 direct;
        uint256 upline;
        uint256 level;
        uint256 leftOver;
        uint256 royalty;
        uint256 claimed;
    }

    struct BonusRecord {
        uint256 amount;
        uint256 timestamp;
        string bonusType;
        uint256 fromSlot;
    }

    struct LostIncome {
        uint256 fromSlot;
        uint256 amount;
        uint256 time;
    }

    mapping(address => BonusRecord[]) public bonusHistory;
    // Track lost incomes per user
    mapping(address => LostIncome[]) public lostIncomes;



    mapping(address => User) public users;
    mapping(address => Earnings) public earnings;
    mapping(address => mapping(uint256 => bool)) public userSlots;
    mapping(uint256 => uint256) public royaltyPerSlot;
    mapping(uint256 => address[]) public userAddressPerSlot;
    mapping(address => uint256) public levelBonus;
    mapping(address => uint256) public rewardBonus;

    event Registered(address indexed user, address indexed referrer);
    event SlotPurchased(address indexed user, uint256 slot);
    event Deactivated(address indexed user);
    event AutoUpgrade(address indexed user, uint256 newSlot);

    constructor(address _usdc,address _rootUser) {
        usdc = IERC20(_usdc);
        owner = msg.sender;
        rootUser = _rootUser;
        users[_rootUser] = User({
            referrer: address(0),
            placementUpline:address(0),
            left: address(0),
            right: address(0),
            directs: new address[](0),
            registeredAt: block.timestamp,
            activatedAt: block.timestamp,
            activeSlots: 15,
            isFlipped: false,
            autoUpgrade: false,
            savedForUpgrade: 0,
            exists: true,
            isActive: true,
            lastIncomeAt:0
        });

        for (uint8 i = 1; i <= 15; i++) {
            userSlots[msg.sender][i] = true;
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

   function isSlotActive(address user, uint256 slot) internal view returns (bool) {
        return users[user].activeSlots >= slot;
    }

    function register(address _referrer) external {
        require(!users[msg.sender].exists, "User exists");
        require(users[_referrer].exists, "Invalid referrer");
        require(msg.sender != _referrer, "Cannot refer yourself");

        address placement = findFreePlacement(_referrer);

        users[msg.sender] = User({
            referrer: _referrer,
            placementUpline: placement,
            left: address(0),
            right: address(0),
            directs: new address[](0),
            registeredAt: block.timestamp,
            activatedAt: 0,
            activeSlots: 0,
            isFlipped: false,
            autoUpgrade: true,
            savedForUpgrade: 0,
            exists: true,
            isActive: false,
            lastIncomeAt:0
        });

        if (users[placement].left == address(0)) {
            users[placement].left = msg.sender;
        } else {
            users[placement].right = msg.sender;
        }

        users[_referrer].directs.push(msg.sender);
        emit Registered(msg.sender, placement);
    }

    function findFreePlacement(address start) public view returns (address) {
        address[10000] memory queue;
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
                if(i==1){
                    users[msg.sender].isActive = true;
                    users[msg.sender].activatedAt = block.timestamp;
                }
                users[msg.sender].activeSlots++;
                userAddressPerSlot[i].push(msg.sender);
                distributeIncome(msg.sender, i);
                emit SlotPurchased(msg.sender, i);
            }
        }
    }

    function distributeIncome(address user, uint256 slot) internal {
        uint256 amount = slotPrices[slot - 1];
        uint256 directShare;
        uint256 uplineShare;
        uint256 royaltyShare;
        uint256 levelShare = (amount * 15) / 100;

        if (slot == 1) {
            directShare = (amount * 70) / 100;
            royaltyShare = (amount * 15) / 100;
            address ref = users[user].referrer;
            if (ref != address(0)) {
                handleDirectIncome(ref, directShare,slot);
            }
        } else if (slot == 2) {
            royaltyShare = (amount * 15) / 100;
            uplineShare = (amount * 70) / 100;
            address secondUpline = getNthUpline(user, 2);
            if (secondUpline != address(0)) {
                handleUplineIncome(secondUpline, uplineShare,slot);
            }
        } else {
            directShare = (amount * 30) / 100;
            uplineShare = (amount * 30) / 100;
            royaltyShare = (amount * 25) / 100;
            address ref = users[user].referrer;
            if (ref != address(0)) {
                handleDirectIncome(ref, directShare,slot);
            }
            address nthUpline = getNthUpline(user, slot);
            if (nthUpline != address(0)) {
                handleUplineIncome(nthUpline, uplineShare, slot);
            }
        }

        address current = users[user].placementUpline;
        uint256 perLevel = levelShare / 25;
        uint256 distributed;
        for (uint8 i = 0; i < 25; i++) {
            if (current != address(0)) {
                handleLevelIncome(current, perLevel,slot);
                distributed += perLevel;
                current = users[current].placementUpline;
            } else {
                break;
            }
        }
        // Save the unassigned portion as reserve
        uint256 leftover = levelShare - distributed;
        if (leftover > 0) {
            levelReserve += leftover;
        }

        royaltyPerSlot[slot] += royaltyShare;
    }

   function getNthUpline(address user, uint256 level) internal view returns (address) {
        address current = user;
        for (uint256 i = 0; i < level; i++) {
            if (current == address(0)) break;
            current = users[current].placementUpline;
        }
        return current;
    }

    function handleDirectIncome(address user , uint256 amount ,uint256 slot) internal {
        if(isEligibleForIncome(user)){
            if (users[user].isActive) {
                if (users[user].autoUpgrade && users[user].activeSlots < 15) {
                    users[user].savedForUpgrade += amount;
                    (bool upgraded, uint256 leftover) = tryAutoUpgrade(user);
                    if (upgraded && leftover > 0) {
                        earnings[user].leftOver += leftover;
                        bonusHistory[user].push(BonusRecord(leftover, block.timestamp, "leftOver", slot));
                    }
                }else{
                    earnings[user].direct += amount;
                    bonusHistory[user].push(BonusRecord(amount, block.timestamp, "direct", slot));
                    users[user].lastIncomeAt = block.timestamp;
                    require(usdc.transfer(user, amount), "Direct transfer failed");
                }
            }
        }else {
            _handleFallbackIncome(amount, slot);
        }
    }

    function handleUplineIncome(address user,uint256 amount,uint256 slot ) internal {
        if(isEligibleForIncome(user)){
            if (isSlotActive(user, slot)) {
                if (users[user].autoUpgrade && users[user].activeSlots < 15) {
                    users[user].savedForUpgrade += amount;
                    (bool upgraded, uint256 leftover) = tryAutoUpgrade(user);
                    if (upgraded && leftover > 0) {
                        earnings[user].leftOver += leftover;
                        bonusHistory[user].push(BonusRecord(leftover, block.timestamp, "leftOver", slot));
                    }
                } else {
                        earnings[user].upline += amount;
                        bonusHistory[user].push(BonusRecord(amount, block.timestamp, "upline", slot));
                        users[user].lastIncomeAt = block.timestamp;
                        require(usdc.transfer(user, amount), "Upline transfer failed");
                }
            } else {
                lostIncomes[user].push(LostIncome({fromSlot: slot, amount: amount, time: block.timestamp}));
                require(usdc.transfer(rootUser, amount), "Fallback transfer failed");
                bonusHistory[rootUser].push(BonusRecord(amount, block.timestamp, "From unMatched_slot", slot));
            }
        }else{
            _handleFallbackIncome(amount, slot);
        }
    }

    function handleLevelIncome(address user, uint256 amount, uint256 slot ) internal {
        if(isEligibleForIncome(user)){
            earnings[user].level += amount;
            levelBonus[user] += amount;
            bonusHistory[user].push(BonusRecord(amount, block.timestamp, "level", slot));
        }else {
            _handleFallbackIncome(amount, slot);
        }
    }

    function _handleFallbackIncome(uint256 amount, uint256 slot) internal {
        require(usdc.transfer(rootUser, amount), "Fallback transfer failed");
        bonusHistory[rootUser].push(BonusRecord(amount, block.timestamp, "from_UnActive_user", slot));
    }

    function tryAutoUpgrade(address user) internal returns  (bool upgraded, uint256 leftover) {
            uint256 currentSlot = users[user].activeSlots;
            bool hasUpgraded = false;
            uint256 leftAmount;
            while (currentSlot < 15) {
                uint256 nextSlotPrice = slotPrices[currentSlot];
                if (users[user].savedForUpgrade >= nextSlotPrice) {
                    users[user].savedForUpgrade -= nextSlotPrice;
                    currentSlot++;
                    users[user].activeSlots = currentSlot;
                    userSlots[user][currentSlot] = true;
                    distributeIncome(user, currentSlot);
                    emit AutoUpgrade(user, currentSlot);
                    hasUpgraded = true;
                    leftAmount = users[user].savedForUpgrade;
                    users[user].savedForUpgrade = 0;
                } else {
                    break;
                }
            }
            // After upgrade loop, return leftover if any
            return (hasUpgraded, leftAmount);
    }


    function claimEarnings() external {
        uint256 total = earnings[msg.sender].leftOver + levelBonus[msg.sender];
        require(total > 0, "Nothing to claim");
        earnings[msg.sender].leftOver = 0;
        levelBonus[msg.sender] = 0;
        earnings[msg.sender].claimed += total;
        usdc.transfer(msg.sender, total);
    }

    function countActiveDirects(address user) internal view returns (uint256) {
        uint256 count = 0;
        User storage u = users[user];
        for (uint256 i = 0; i < u.directs.length; i++) {
            if (users[u.directs[i]].isActive) {
                count++;
            }
        }
        return count;
    }

    function isEligibleForReward(address user) public view returns (bool) {
        User storage u = users[user];
        // Check if user has purchased level 10
        if (!isSlotActive(user, 10)) {
            return false;
        }
        uint256 count = 0;
        // Loop through directs and check if at least 2 have purchased level 9
        for (uint256 i = 0; i < u.directs.length; i++) {
            if (isSlotActive(u.directs[i], 9)) {
                count++;
            }
            if (count >= 2) {
                return true;
            }
        }
        return false;
    }


    function isEligibleForIncome(address user) public view returns (bool) {
        if(user == rootUser){
            return true;
        }
        uint256 registrationTime = users[user].registeredAt;
        if (block.timestamp > registrationTime + 1 hours) { //7 days for prod
            // Check how many direct referrals are active
            uint256 activeDirects = 0;
            address[] storage directs = users[user].directs;
            for (uint256 i = 0; i < directs.length; i++) {
                if (users[directs[i]].isActive) {
                    activeDirects++;
                }
            }
            if (activeDirects < 2) {
                return false;
            }
        }
        return true;
    }


    function setAutoUpgrade(bool enabled) external {
        users[msg.sender].autoUpgrade = enabled;
    }

    function getEarningsBreakdown(address user) external view returns (
        uint256 direct,
        uint256 upline,
        uint256 level,
        uint256 leftOver,
        uint256 royalty,
        uint256 claimed
    ) {
        Earnings memory e = earnings[user];
        return (e.direct, e.upline, e.level,e.leftOver, e.royalty, e.claimed);
    }

    function distributeRoyaltyLevelWise(
        uint256 slot,
        uint256 totalAmount
    ) external onlyOwner {
        require(totalAmount > 0, "Amount must be greater than 0");

        address[] memory usersAtSlot = userAddressPerSlot[slot];
        uint256 eligibleCount = 0;

        // First, count how many are eligible
        for (uint256 i = 0; i < usersAtSlot.length; i++) {
            if (isEligibleForRoyalty(usersAtSlot[i])) {
                eligibleCount++;
            }
        }
        require(eligibleCount > 0, "No eligible users for royalty");
        uint256 sharePerUser = totalAmount / eligibleCount;
        for (uint256 i = 0; i < usersAtSlot.length; i++) {
            address user = usersAtSlot[i];
            if (isEligibleForRoyalty(user)) {
                earnings[user].royalty += sharePerUser;
                bonusHistory[user].push(BonusRecord(sharePerUser, block.timestamp, "royalty", slot));
                users[user].lastIncomeAt = block.timestamp;
                require(usdc.transfer(user, sharePerUser), "Royalty transfer failed");
            }
        }
    }


    function isEligibleForRoyalty(address user) public view returns (bool) {
        if (!users[user].exists) return false;
        if (userSlots[user][8]) {
            return true;
        }
        // Check if received income in last 7 days
        return (users[user].lastIncomeAt +  7 days >= block.timestamp);
    }

    function transfer(address _receiver,uint256 amount) external onlyOwner {
        require(_receiver != address(0),"Invalid receiver");
        usdc.transfer(_receiver, amount);
    }

    function adminActivateSlot(address user, uint256 slot) external onlyOwner {
        require(users[user].exists, "User not registered");
        require(slot >= 1 && slot <= 15, "Invalid slot");

        for (uint256 i = 1; i <= slot; i++) {
            if (!userSlots[user][i]) {
                userSlots[user][i] = true;
                if(i == 1) {
                    users[user].isActive = true;
                    users[user].activatedAt = block.timestamp;
                }
                users[user].activeSlots++;
                userAddressPerSlot[i].push(user);
                emit SlotPurchased(user, i);
            }
        }
    }

    function getDirects(address user) external view returns (address[] memory) {
        return users[user].directs;
    }

    function getDirectLength(address user) external view returns (uint256 length) {
        return users[user].directs.length;
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

     // calculate slot price 
    function getSlotPrice(address _user,uint256 _slot) external view returns (uint256 amount) {
        // accumulate price according to acitve slot and left slot
        uint256 totalPrice = 0;
        for (uint256 i = 1; i <= _slot; i++) {
            if (!userSlots[_user][i]) {
                totalPrice += slotPrices[i - 1];
            }
        }
        return totalPrice;
    }

    function getTodaysBonus(address user) external view returns (
        uint256 totalBonus,
        BonusRecord[] memory todayRecords
    ) {
        uint256 count = 0;
        uint256 todayStart = block.timestamp - (block.timestamp % 1 days);
        BonusRecord[] memory all = bonusHistory[user];

        // First pass: count today's entries
        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].timestamp >= todayStart) {
                count++;
            }
        }

        // Allocate and collect today's records
        todayRecords = new BonusRecord[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].timestamp >= todayStart) {
                todayRecords[j++] = all[i];
                totalBonus += all[i].amount;
            }
        }
    }

    function getLostIncomeDetails(address user) external view returns (
        uint256 totalLost,
        uint256 todayLost,
        uint256 yesterdayLost,
        uint256[15] memory slotWiseLost
    ) {
        LostIncome[] memory losses = lostIncomes[user];
        uint256 startOfToday = block.timestamp - (block.timestamp % 1 days);
        uint256 startOfYesterday = startOfToday - 1 days;

        for (uint256 i = 0; i < losses.length; i++) {
            uint256 amount = losses[i].amount;
            uint256 time = losses[i].time;
            uint256 slotIndex = losses[i].fromSlot;

            totalLost += amount;

            if (slotIndex > 0 && slotIndex <= 15) {
                slotWiseLost[slotIndex - 1] += amount;
            }

            if (time >= startOfToday) {
                todayLost += amount;
            } else if (time >= startOfYesterday) {
                yesterdayLost += amount;
            }
        }
    }

    function distributeReward(address _user,uint256 amount) external  onlyOwner {
        require(isEligibleForReward(_user),"user is not eligible");
        rewardBonus[_user] += amount;
        usdc.transfer(_user,amount);
        bonusHistory[_user].push(BonusRecord(amount, block.timestamp, "reward",10));
    }

    function transferOwner(address _newOwner)  external onlyOwner {
        require(_newOwner != address(0),"Invalid new owner");
        owner = _newOwner;
    }

}